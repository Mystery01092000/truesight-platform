# Forge — visual multi-cloud designer & deployer

**Date:** 2026-07-07
**Status:** Approved (design review with product owner)
**Feature name:** Forge (`/forge`)

## Problem

Truesight is a read-only watcher: it discovers and visualizes AWS/Azure estates
but cannot create anything. Users want to *design* infrastructure visually —
drag services onto a 2D canvas, arrange them inside resource groups / VNets /
subnets, save those designs as plans, and deploy them — with Terraform doing
the real work underneath.

## Decisions (locked during design review)

| Decision | Choice |
|---|---|
| Deploy depth (v1) | Full pipeline: generate → `terraform plan` → review → `terraform apply`; destroy supported |
| Terraform runtime | In-app terraform binary; per-plan workspace with local tfstate on the Docker volume; tfstate snapshotted to Postgres after each run |
| Catalog breadth | Curated core (~12 services per cloud), data-driven so new services are one file each |
| Credentials | Separate `DEPLOY_AWS_*` / `DEPLOY_AZURE_*` env vars used only by Forge's terraform subprocess; platform estate creds stay read-only |
| Codegen | Canvas graph → Terraform JSON syntax (`main.tf.json`), valid by construction; HCL-style pretty preview rendered for humans |
| Canvas library | `@xyflow/react` (React Flow) — already used by the Topology page; reuse theme and node patterns |
| Mixed-cloud plans | Allowed — one canvas/config may contain both AWS and Azure resources |

## User flow

1. Open **Forge** in the sidebar (`/forge`). Plans list → open or create a plan.
2. Palette (left): AWS/Azure tabs, category-grouped service tiles + a searchable
   dropdown. Drag a tile onto the canvas.
3. Containers: Azure `Resource Group → VNet → Subnet`; AWS `VPC → Subnet`.
   Container services render as resizable React Flow **group nodes**
   (`parentId` + `extent: "parent"`). Drops are validated against
   `allowedParents`; invalid drops flash red and bounce back.
4. Select a node → inspector panel (right) renders its form from the catalog
   field spec (name, instance size, CIDR, engine version…). Validation inline.
5. Edges express explicit dependencies (e.g., VM → security group).
6. **Save** (named plan, versioned) → **Generate** (view `main.tf.json` + HCL
   preview, download zip) → **Plan** (streamed `terraform plan` output) →
   **Deploy** (typed plan-name confirmation, admin only) → run history/logs.
   **Destroy** per deployed plan, same gating.

## Architecture

### Catalog — `lib/forge/catalog/` (one file per service)

```ts
interface ForgeService {
  id: string;                    // "aws.vpc", "azure.linux_vm"
  provider: "aws" | "azure";
  label: string;
  icon: LucideIcon;
  category: "network" | "compute" | "storage" | "database" | "serverless" | "containers" | "identity" | "observability";
  isContainer: boolean;          // renders as group node
  allowedParents: string[];      // [] = top-level only
  fields: ForgeField[];          // zod-backed form spec
  toTf(node: ForgeNode, ctx: TfContext): TfFragment;  // emits tf.json fragment
}
```

**v1 services — AWS (12):** VPC, Subnet, Security Group, EC2 instance, S3
bucket, RDS instance (postgres/mysql), Lambda function, ECS cluster, ECS
service, IAM role, CloudWatch log group, ECR repository.

**v1 services — Azure (12):** Resource Group, Virtual Network, Subnet, NSG,
Linux VM, Windows VM, Storage Account, Azure SQL (server+db), Function App,
Container App, Log Analytics workspace, ACR.

The palette, the dropdown form, and codegen all render from this single
definition. Adding a service later = add one file + register it.

### Data model — drizzle migration

- `forge_plans`: id, name, description, canvas_json (jsonb — source of truth),
  tf_json (jsonb — last generated), status
  (`draft | generated | planned | deploying | deployed | failed | destroyed`),
  created_by, created_at, updated_at, version.
- `forge_runs`: id, plan_id (fk), kind (`plan | apply | destroy`), status
  (`running | succeeded | failed`), log (text, appended while streaming),
  exit_code, started_at, finished_at, triggered_by.

### Terraform generation — `lib/forge/terraform.ts`

- Walk canvas graph → `main.tf.json` (Terraform JSON syntax). No string
  templating; structure is valid by construction.
- `terraform.required_providers` and `provider` blocks include only the clouds
  actually present on the canvas.
- Containment auto-wires references: a node inside a subnet gets
  `subnet_id = "${aws_subnet.<name>.id}"`; Azure children get
  `resource_group_name` / `virtual_network_name` from ancestors.
- Explicit edges wire non-containment references (SG attachment, role
  attachment).
- Resource names: slugified from user names, uniqueness enforced at
  generation; collisions are validation errors pointing at the node.
- Every node's form values validated with zod **before** generation; errors
  map back to canvas nodes (red ring + inspector message).
- HCL-style pretty preview rendered read-only next to the JSON; download
  button ships the workspace as a zip.

### Runner — `lib/forge/runner.ts`

- Workspace per plan: `var/forge/<planId>/main.tf.json` + local tfstate,
  persisted on the Docker volume; tfstate snapshotted into Postgres after
  every run (restore path if the volume is lost).
- Spawns `terraform init` / `plan` / `apply -auto-approve` / `destroy`
  with `-no-color`; stdout/stderr appended to `forge_runs.log` and streamed
  to the client over SSE.
- Concurrency: one active run per plan (DB row lock); stale `running` runs
  (process died) swept to `failed` on next access.
- **Credentials:** `DEPLOY_AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY/REGION`,
  `DEPLOY_AZURE_CLIENT_ID/CLIENT_SECRET/TENANT_ID/SUBSCRIPTION_ID` injected
  only into the terraform subprocess environment. Estate (read-only) creds are
  never passed to Forge. Missing creds ⇒ Plan/Deploy buttons render a
  "deploy credentials not configured" state; canvas/save/generate still work.
- Terraform binary added to the Docker image; preflight check reports
  "terraform not installed" gracefully (local dev without the binary).

### RBAC

New actions: `forge:read` (all roles), `forge:write` (save/generate/plan —
admin + operator), `forge:deploy` (apply/destroy — admin only). Apply/destroy
additionally require typing the plan name to confirm.

### API — `app/api/forge/`

- `GET/POST /api/forge/plans`
- `GET/PUT/DELETE /api/forge/plans/[id]`
- `POST /api/forge/plans/[id]/generate`
- `POST /api/forge/plans/[id]/run` (body: `{ kind: "plan" | "apply" | "destroy" }`)
- `GET /api/forge/plans/[id]/runs/[runId]/stream` (SSE log tail)

All inputs zod-validated; consistent `{ success, data, error }` envelope;
RBAC enforced per action; rate limiting consistent with existing routes.

### UI — `app/(app)/forge/` + `components/forge/`

- `/forge` — plans list (DataTable: name, clouds, status, last run, updated).
- `/forge/[id]` — the designer: `Palette` (left), `ForgeCanvas` (center,
  React Flow with `ServiceNode`/`ContainerNode` custom nodes reusing Topology
  styling), `Inspector` (right), toolbar (Save / Generate / Plan / Deploy /
  Destroy + status pill), `RunDrawer` (streamed terraform output).
- Nav: `Forge` item in `lib/nav.ts` (+ command palette route). New RBAC-aware
  visibility consistent with existing gating.

## Error handling

- Form/validation errors: inline on nodes and in the inspector; generation
  refuses until clean.
- Terraform failures: full log preserved on the run, plan status → `failed`,
  re-runnable after fixes.
- Crash safety: `running` runs with a dead process are marked `failed` by the
  stale-run sweeper; workspace is always regenerable from `canvas_json`.
- The DB is the single source of truth; the workspace dir is disposable.

## Testing

Vitest (new dev-dependency, first test infra in the repo) over `lib/forge/*`:

- Catalog: every service's field spec validates/rejects correctly.
- Codegen: snapshot tests of graph → `main.tf.json` for both clouds — nesting,
  cross-references, mixed-cloud, name collisions, empty canvas.
- Runner: state machine with a stubbed `terraform` shell script (records
  args, emits canned output, exit codes).
- API: zod boundary tests for the plans routes.

E2E (optional, Playwright): create plan → drag EC2 into subnet → save →
generate → assert tf.json content.

## Out of scope for v1

Remote state backends (S3/azurerm), drift detection against the live estate,
cost estimation of plans, importing existing estate resources onto the canvas,
multi-user concurrent editing, terraform module/version pinning UI.
