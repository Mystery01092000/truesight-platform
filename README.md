# Truesight

**Cloud governance with no blind spots — an enterprise IaaS experience layer across DevOps.**

Truesight (after *truesight*, the arcane vision that sees things exactly as they are) is a premium, visual, self-discovering
single pane across AWS + Azure estates, GitHub org activity, Terraform drift, cost, security, and
compliance. It runs full-stack, live, with **real data on every screen — no stubs** — at
[https://truesight.arcane.tech](https://truesight.arcane.tech)
for a small set of gated DevOps admins, at **< $50/month**.

> Autonomous agents: read this file, then work strictly from [`docs/TASKS.md`](docs/TASKS.md).
> Every task there has stable IDs, file lists, dependencies, and acceptance criteria so you can
> pick one up and ship it in isolation.

---

## What Truesight is — the 7 pillars

| # | Pillar | One-liner |
|---|--------|-----------|
| 1 | **Landing + gated auth** | Motion-first narrative landing (animated aperture + auto-cycling capability showcase); credential login, `jose` JWT in httpOnly cookie, Azure Entra SSO slot ready. |
| 2 | **AWS estate explorer** | Multi-account (mgmt/prod/dev) via STS AssumeRole; ECR/ECS/S3/RDS/DocumentDB/SSM/Bedrock/EC2-VPC as animated tiles, tables drill-down only. |
| 3 | **Azure estate explorer** | Resource Graph KQL over `rg-arcane-prod`, at parity with AWS via reused estate components. |
| 4 | **GitHub org insights** | `arcane` org: Team→Member→Repo enum + GraphQL insights (languages, commit counts, top devs). |
| 5 | **Signature topology canvas** | `@xyflow/react` + `elkjs` source-to-runtime graph: Dockerfile stages, Terraform modules, Jenkins pipeline stages linked to live cloud, drift-aware. |
| 6 | **Compliance / Security / Checklists / KB** | Postgres-backed governance as guided, status-tracked workflows + verified-checklist (✓) view; includes the live vulnerability scanner and drift findings. |
| 7 | **Cost dashboard** | Real-time spend filterable by product/tag × time; AWS Cost Explorer + Azure Cost Management. |

**Read-only-estate principle.** Truesight **never mutates infrastructure** — no `terraform apply`/`plan`
against the estate, no writes to any cloud resource. This is enforced at the **IAM boundary**: Truesight
assumes a purpose-built `truesight-readonly` role (AWS-managed `ViewOnlyAccess`) into each account, and
Terraform state is `s3:GetObject` only. Read-only is a hard guarantee, not a code convention.

---

## Architecture at a glance

- **Full-stack Next.js 16 App Router** (`output: 'standalone'`) on **ECS Fargate** — one container, SSR + Route Handlers.
- **RSC + Route Handlers BFF** — Server Components / Server Actions by default; `app/api/*` is the backend-for-frontend. `/api/health` is unauthenticated.
- **Drizzle ORM + Postgres** as the knowledge base (append-only `resource_snapshots` + materialized `resources`/`resource_edges` + findings/cost/checklist tables).
- **In-process cache** (`MemoryCacheDriver`, single Fargate task) behind a driver interface — **Redis-swappable** (`RedisCacheDriver` when `REDIS_URL` is set).
- **Integration adapters** (`create*Adapter(cfg)` factories, no module state) for **AWS / Azure / GitHub / Terraform / Docker / Jenkins**, each with `healthCheck()` + `discover() → DiscoveryResult`.
- **Canonical `lib/taxonomy` enum layer** — `CloudProvider`, `ResourceKind`, `DriftStatus`, `Severity`, `ServiceCategory`, `PipelineStageKind`, … + per-provider mapping tables, shared by integrations AND frontend so a new provider is a mapping, not a rewire.
- **Signature React Flow topology canvas** — ELK layered layout computed server-side for stable first paint, live deltas over SSE, drift overlays, Kowalski-restrained entrance motion.
- **Unified `CloudResource` model** keyed by `urn` (`provider:account:region:service:nativeId`) — the single join key across live discovery, Terraform state, and the KB.

Data path: UI read = **cache-first → latest Postgres snapshot → background refresh**, always renders
immediately. Routes **degrade-never-blank**: they return `200 { data, partial, errors, stale }` with a
"degraded — N scopes unavailable" banner instead of a broken screen. Sync runs via `POST /api/sync`
(admin refresh) and an EventBridge ECS Scheduled Task (~10 min) hitting the same entrypoint.

---

## Tech stack

| Concern | Choice | Version |
|---------|--------|---------|
| Framework | Next.js (App Router, RSC) | 16.2.9 |
| UI runtime | React + React DOM | 19.2.7 |
| Styling | Tailwind CSS v4 (`@theme` = DESIGN.md tokens 1:1) | 4.3.2 |
| ORM / driver | Drizzle ORM + `postgres.js` + drizzle-kit | 0.45.2 / 3.4.9 |
| Auth | `jose` JWT (HS256) + `bcryptjs` | 6.2.3 / 3.0.3 |
| Topology | `@xyflow/react` + `elkjs` | 12.11.1 / 0.11.1 |
| Motion | `motion` (orchestration) + Rive/Lottie (ambient aperture) | 12.42.2 |
| Command palette | `cmdk` ("Ask Truesight") | 1.1.1 |
| Data fetching | TanStack Query (client islands) + TanStack Table (drill-down) | 5.101.2 / 8.21.3 |
| Icons | lucide-react | 1.22.0 |
| Validation | zod | 4.4.3 |

---

## Project structure

```
iac-truesight-platform/
├─ app/
│  ├─ (marketing)/          # landing narrative (aperture + capability showcase)
│  ├─ (auth)/               # login
│  ├─ (app)/                # gated app: aws, azure, github, topology, cost, security, compliance
│  ├─ api/                  # BFF route handlers — /api/health (public), /api/sync, /api/topology/{graph,stream}
│  ├─ globals.css           # DESIGN.md tokens as Tailwind v4 @theme (ss03, surface ladder, no shadows)
│  └─ layout.tsx
├─ lib/
│  ├─ auth/                 # session.ts (jose JWT), providers/{credentials,azure-entra}, rbac.ts
│  ├─ integrations/         # types.ts + aws/ azure/ github/ terraform/ repo/ sync/
│  ├─ taxonomy/             # canonical enums + provider mapping tables (shared by integrations + UI)
│  ├─ cache/                # cached.ts + Memory/Redis drivers
│  ├─ topology/             # graph merge + ELK layout helpers
│  ├─ config/               # env parsing (zod)
│  └─ utils/                # cn.ts, helpers
├─ components/
│  ├─ ui/                   # Surface, Button, Keycap, PillTabs, Badge, TextInput, DataTable …
│  ├─ command/              # ⌘K "Ask Truesight" palette
│  ├─ nav/                  # Sidebar, TopBar, AppShell
│  ├─ topology/             # TopologyCanvas + nodes/ edges/
│  ├─ estate/               # account/region/service tiles, AppIconTile
│  └─ widgets/              # cost tiles, drift gauges, vuln counters, sparklines
├─ db/                      # schema.ts, migrate.ts, seed.ts, migrations/
├─ deploy/terraform/        # self-contained Truesight infra (git-sourced shared modules)
├─ docs/TASKS.md            # granular ordered task breakdown for autonomous execution
├─ middleware.ts            # protects (app)/* + /api/* (except health/auth)
├─ Dockerfile               # multi-stage node:26-alpine → standalone runner
├─ docker-compose.yml       # local postgres:16 (+ optional redis:7)
└─ Jenkinsfile              # cwt-jenkins-library pipeline
```

---

## Local development

**Prereqs:** Node **26**, Docker.

```bash
cp .env.example .env.local          # then fill from the real .env.local (real read-only creds)
gh auth token                     # copy into GITHUB_PAT= in .env.local (never commit)
docker compose up -d              # local postgres:16 (+ optional redis:7)
npm ci
npm run db:migrate                # apply Drizzle migrations
npm run db:seed                   # seed admin user + baseline
npm run dev                       # http://localhost:3000
```

Sign in with **`admin`** / **`truesight-dev-2026`** (role `DEVOPS_SUPER_ADMIN`).

`.env.local` wires the local DB **plus real read-only AWS/Azure/GitHub creds**, so every panel shows
real data locally. Validate the production image before shipping:

```bash
docker build -t truesight:test .
docker run --env-file .env.local -p 3000:3000 truesight:test
```

---

## Integrations & security model

| Integration | Access method | Boundary |
|-------------|---------------|----------|
| AWS | STS **AssumeRole** (mgmt base creds → `truesight-readonly` / `ViewOnlyAccess` per account) | Read-only IAM role, not code convention |
| Azure | `@azure/identity` **Service Principal** (`ClientSecretCredential`); Resource Graph KQL | Reader over `rg-arcane-prod` |
| GitHub | **PAT** via `gh auth token` (bluntj-ra: `repo`, `read:org`, `workflow`) | Org-scoped read |
| Terraform | `s3:GetObject` on state in `terraform-iac-data` | **Read-only** — never locks, never `plan`/`apply` |
| Docker / Jenkins | Static parse of `Dockerfile` / `Jenkinsfile` in repos | No execution |

- **Secrets** — in prod, SSM SecureStrings under **`/arcane/prod/truesight/*`**; locally, **`.env.local`** (gitignored). **Secrets are NEVER committed.**
- **Stateless server** — secrets from env → SSM; durable state in Postgres; cache in-process; no module-level mutable state.
- **Auth** — `truesight_session` httpOnly `Secure` `SameSite=Lax` cookie, `jose` HS256, 8h sliding; `middleware.ts` guards `(app)/*` + `/api/*` (except `/api/health` and auth); Server Actions re-check `getSession()`.

---

## Deployment

Footprint **~$44/mo** (target < $50), isolated, on-demand, no CloudFront / no ElastiCache.

```
Route53 (MGMT acct alias) truesight… ─ALIAS→ ALB (prod)
  ALB :443 (regional ACM *.arcane.tech) → TG :3000 ; :80→443 redirect
  → 1× Fargate task (0.25 vCPU / 0.5 GB, autoscale max 2) in PRIVATE subnets
       Next.js standalone :3000 · in-process cache · /api/health
  → RDS db.t4g.micro (DATA subnets, SG: 5432 from truesight-ecs-sg only)
```

- **Terraform** is self-contained in `deploy/terraform/` — backend `s3://terraform-iac-data` key `truesight/prod/terraform.tfstate`; reuses the **existing prod VPC** via `terraform_remote_state` (read-only outputs); shared modules via git-sourced pinned refs. Truesight provisions its **own** infra in prod account `404063516552`; the estate stays read-only.
- **Route53** record created via a **management-account provider alias** (zone lives in mgmt account `664224997032`).
- **Default tags** on every provisioned resource: `Owner=rishabh`, `Team=infra-services`, `Project=truesight`, `Environment=prod`, `ManagedBy=terraform` — these drive cost-dashboard attribution and estate grouping.
- **CI/CD** — `Jenkinsfile` via `@Library('cwt-jenkins-library')`: Checkout → Install → Lint & Typecheck → Test → Build → `cwtDockerBuildPush` → `cwtEcsDeploy` → `cwtHealthCheck` → live smoke test. Migrations run as a one-off pipeline task, **never at boot**.
- **Live URL:** [https://truesight.arcane.tech](https://truesight.arcane.tech)

---

## Conventions

- **Commits** — feature-segregated, enterprise style; PR → `main` as **Rishabh Arya** (`maintainer@arcane.tech` / bluntj-ra). **No Claude/agent co-author trailers, no agent marker files.**
- **No stubs** — every screen ships real data. No mocks, demo labels, placeholders, or "coming soon" on any route. This is the shipping bar; see the Definition of Done in [`docs/TASKS.md`](docs/TASKS.md).
- **Design** — Raycast aesthetic (near-black `#07080a` canvas, 4-step surface ladder, hairline `#242728` borders, **no drop shadows**, white CTA pills, Inter `ss03`); Emil-Kowalski-restrained motion. Elevation via `<Surface level={0..3}>`; accents only inside `AppIconTile`. See `DESIGN.md`.
- **`.gitignore`** — Node/Next; ignores `.env*`, `node_modules`, `.next`, `deploy/terraform/.terraform`, `*.tfstate*`.

---

## Next steps

Work is tracked task-by-task for autonomous execution in **[`docs/TASKS.md`](docs/TASKS.md)** —
ordered by phase (0 Docs → 8 Go-live), each task with files, dependencies, and acceptance criteria.

*Built by Arcane, 2026.*
