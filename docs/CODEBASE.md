# Truesight Platform — Codebase Documentation

> Generated 2026-07-05 from a full-codebase survey. Companion docs: [README.md](../README.md) (product overview),
> [DESIGN.md](../DESIGN.md) (design system), [architecture-frontend.md](./architecture-frontend.md) (frontend ADR),
> [TASKS.md](./TASKS.md) (build plan), [FRONTEND-CURATION.md](./FRONTEND-CURATION.md) (UI audit).

Truesight is a **read-only, multi-cloud governance platform** ("cloud governance with no blind spots") that gives a
single pane of glass over an organization's AWS accounts, Azure subscriptions, GitHub org, Terraform estate,
cost, security posture, and compliance — plus an access-ticketing workflow and a RAG knowledge base.

**Read-only estate principle:** Truesight never mutates cloud infrastructure. All cloud access goes through
read-only credentials (`truesight-readonly` IAM role / `ViewOnlyAccess`, Azure Reader-scoped service principal,
GitHub PAT). The only writes are to Truesight's own Postgres database.

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, RSC-first, standalone output), React 19 |
| Language | TypeScript 6, Node 26 |
| Styling | Tailwind CSS 4 (`@theme` tokens in `app/globals.css`), dark-only design system per `DESIGN.md` |
| Data fetching (client) | TanStack Query 5, TanStack Table 8, TanStack Virtual |
| Graph canvas | `@xyflow/react` (React Flow) + `elkjs` layout |
| Motion | `motion` (Framer Motion successor) |
| ORM / DB | Drizzle ORM + `postgres` (postgres-js), PostgreSQL 16 with **pgvector** |
| Cache | Redis via `ioredis` (optional — falls back to in-process memory driver) |
| Auth | `jose` JWT sessions, `bcryptjs` credentials, Microsoft Entra ID OIDC SSO |
| Cloud SDKs | AWS SDK v3 (STS, EC2, ECS, ECR, RDS, S3, Tagging, Cost Explorer, Inspector2, Security Hub, Bedrock), Azure (`@azure/identity`, Resource Graph, subscriptions), Octokit (REST + GraphQL + throttling) |
| AI | AWS Bedrock (Claude Sonnet 4 generation, Titan v2 embeddings), OpenAI (legacy embeddings) |
| Notifications | Nodemailer (SMTP), Microsoft Teams incoming webhooks (Adaptive Cards) |
| Validation | Zod 4 (env config, API inputs) |

## 2. Repository layout

```
app/                    Next.js App Router
  (marketing)/          Public landing page
  (auth)/login/         Sign-in (credentials + Entra SSO)
  (app)/                Authenticated product (13 pillars)
  api/                  Route handlers (all runtime=nodejs)
components/             UI: design-system primitives + feature modules
lib/                    Server-side domain logic (see §5)
db/                     Drizzle schema, migrations, sync/seed/migrate CLIs
deploy/terraform/       Self-contained prod Terraform stack
scripts/                migrate.mjs / seed.mjs (one-off Fargate tasks)
docs/                   Documentation (this file, TASKS, curation, ADRs)
proxy.ts                Edge auth gate (Next 16 middleware successor)
instrumentation.ts      Server-startup hook (cache invalidation wiring)
Dockerfile              App image (standalone Next.js, non-root)
Dockerfile.sync         Sync "toolbox" image (runs the db/*-cli.ts jobs)
Jenkinsfile             CI/CD → ECS Fargate
docker-compose.yml      Local pgvector Postgres + Redis
```

## 3. Application surface (routes)

Three route groups plus APIs. `(app)` is guarded twice: at the edge by `proxy.ts` and server-side by
`app/(app)/layout.tsx`.

| Path | Purpose | Primary data source |
|---|---|---|
| `/` | Marketing landing with live estate stats + inline login | `GET /api/landing-stats` |
| `/login` | Credentials + Entra SSO sign-in | `loginAction`, OIDC flow |
| `/overview` | KPI dashboard: resources, drift, security, spend, sync health | Drizzle counts across core tables |
| `/aws`, `/aws/[account]` | Multi-account AWS estate explorer | `resources` table via `app/(app)/aws/data.ts` |
| `/azure`, `/azure/[rg]` | Azure subscription / resource-group explorer | `app/(app)/azure/data.ts` |
| `/topology` | Live dependency graph canvas (React Flow, ELK layouts, env/provider filters) | `lib/topology/graph.ts` |
| `/github` | Org insights: teams → members → repos, languages, contributors | `lib/github/query.ts` |
| `/cost` | Cross-cloud FinOps console with range filters (7d/30d/90d/MTD) | `app/(app)/cost/data.ts`, `cost_rollups` |
| `/security` | Vulnerability + posture console | `vulnerability_findings`, `security_posture` |
| `/compliance` | Framework coverage, posture gauge, verified checklist, remediation flows | `lib/governance/query.ts` |
| `/plans` | Terraform plan-execution history (discovered from S3) | `lib/integrations/terraform/plans.ts` |
| `/developers`, `/developers/[login]` | LOC/churn leaderboard and per-dev profiles | `developer_stats` rollup |
| `/tickets`, `/tickets/new`, `/tickets/[id]`, `/tickets/admin` | Access-request workflow (multi-stage approvals) | `access_tickets` + child tables |
| `/kb` | Knowledge base: RAG ask panel, semantic search, uploads | `/api/kb/*` |
| `/settings` | Admin-only: scan frequency, platform-admin allowlist, integration health | `integration_accounts`, `platform_admins` |

### API endpoints

All app APIs enforce `getSession()` + `can(role, action)` RBAC. Public exceptions: `/api/health`
(liveness), `/api/landing-stats` (coarse counts, no secrets), `/api/auth/*` (login flows).

Notable groups:
- **Estate:** `POST /api/sync` (trigger full sync), `GET /api/estate/stream` + `GET /api/topology/stream`
  (SSE fed by Postgres LISTEN/NOTIFY — screens live-update when syncs write).
- **Domain reads:** `/api/cost`, `/api/security`, `/api/vulnerabilities`, `/api/compliance`, `/api/developers`.
- **KB:** `POST /api/kb/answer` (RAG), `POST /api/kb/query` (semantic search), document CRUD + S3 presigned
  uploads (`kb:admin`).
- **Tickets:** CRUD + `approve`/`complete` stage transitions.
- **Settings:** admin allowlist CRUD (with last-admin guard), scan frequency.

## 4. Auth, RBAC, and capabilities

- **Edge gate** — `proxy.ts` validates the `truesight_session` JWT cookie (`jose`, HS256, 8h sliding window)
  for all protected page prefixes and `/api/*`; unauthenticated requests get a 401 (API) or a redirect to
  `/login?next=…` (pages).
- **Providers** — `lib/auth/providers/credentials.ts` (bcrypt vs `users` table) and
  `lib/auth/providers/azure-entra.ts` (Entra OIDC; role resolved from the `platform_admins` allowlist).
- **RBAC** — `lib/auth/rbac.ts`: roles `admin | operator | viewer` and a static `can(role, action)` matrix
  over actions like `estate:read`, `sync:trigger`, `kb:admin`, `tickets:admin`, `settings:write`.
- **Capabilities** (`lib/capabilities/`) — a *presentation-only* per-browser filter (cost, security,
  compliance, developers, tickets) that hides nav entries and widgets. It is not a security boundary;
  server-side RBAC is unaffected. The estate core (overview/aws/azure/topology) is never gated.

## 5. Business-logic layer (`lib/`)

| Module | Responsibility |
|---|---|
| `lib/config/env.ts` | Zod-validated `serverEnv()` — the single registry of all env vars/credentials |
| `lib/auth/` | Sessions, RBAC, OIDC, credential + Entra providers, edge token verification |
| `lib/taxonomy/` | Canonical vocabulary: `CloudProvider`, `ResourceKind`, `Severity`, `EdgeKind`, drift/status enums, provider type→kind mappers, accent/icon maps |
| `lib/integrations/types.ts` | The adapter contract: `CloudResource`, `GraphEdge`, `IntegrationAdapter`, `makeUrn()` URN builder |
| `lib/integrations/aws/` | Client factory (STS assume-role into `truesight-readonly`), 900-line discovery adapter, Cost Explorer, Inspector2/Security Hub/ECR vuln scans |
| `lib/integrations/azure/` | Service-principal credential, Resource Graph discovery adapter, Cost Management, Defender findings |
| `lib/integrations/github/` | Octokit client (throttled), org discovery adapter, LOC/contributor analytics engine, Dependabot/code-scanning vulns |
| `lib/integrations/terraform/plans.ts` | Terraform plan-artifact discovery from the state S3 bucket |
| `lib/integrations/sync/` | `orchestrator.ts` (`runSync`: discovery → persist → NOTIFY → cache-bust), `cost-sync.ts`, `security-sync.ts` |
| `lib/estate/`, `lib/github/`, `lib/governance/`, `lib/topology/` | Read-side query modules powering the screens (Drizzle + `cacheable`); topology adds clustering, ELK layout, content-hash caching |
| `lib/kb/` | RAG pipeline: sources (S3, GitHub, resource snapshots, Terraform state) → chunker (`gpt-tokenizer`) → embeddings (Bedrock Titan v2 or OpenAI) → pgvector retrieval → Bedrock answer/stream with citations |
| `lib/ai/bedrock.ts` | `embedTexts`, `generate`, `generateStream` over Bedrock Runtime (Claude Sonnet 4 + Titan) |
| `lib/cache/` | `cacheable()` read-through cache, Redis driver with in-memory fallback, NOTIFY-driven invalidation |
| `lib/realtime/estate-events.ts` | Postgres LISTEN/NOTIFY event bus (drives SSE streams and cache invalidation) |
| `lib/ticketing/` | Access-request domain: tools/access modes, Teams Adaptive Card notifications, SMTP grant emails |
| `lib/nav.ts`, `lib/capabilities/`, `lib/hooks/`, `lib/utils/` | Navigation source of truth, capability model, `usePersistedState`, `cn()`, formatters |

### Core data flow

```
EventBridge schedule / POST /api/sync
        │
        ▼
runSync(adapters)            runCostSync()          runSecurityScan()
  AWS / Azure / GitHub         AWS CE + Azure CM      Inspector2/SecHub/Defender/Dependabot
        │                          │                       │
        ▼                          ▼                       ▼
resources / resource_snapshots   cost_snapshots →       security_posture /
/ resource_edges / integration_  cost_rollups           vulnerability_findings
sync (Postgres)
        │
        ├── pg_notify('estate') ──► lib/realtime ──► SSE streams (UI live-refresh)
        └──────────────────────────► cache invalidation (Redis estate:/topology: keys)
```

Reads go through `lib/*/query.ts` modules wrapped in `cacheable()`; the KB path embeds and retrieves via
pgvector; auth is enforced at the edge, in the app layout, and per-API-route (defense in depth).

## 6. Database (Drizzle / Postgres + pgvector)

Schema: `db/schema.ts`. Conventions: snake_case columns / camelCase TS, `timestamptz` everywhere, UUID PKs
(except `resources`, keyed by URN), JSONB payloads typed via `$type<>` against `lib/taxonomy`.

| Group | Tables |
|---|---|
| Auth | `users` (credentials + `entra_oid`), `platform_admins` (SSO allowlist → role) |
| Discovery | `integration_accounts`, `integration_sync` (runs), `resources` (current state, URN PK, GIN-indexed tags), `resource_snapshots` (append-only change history), `resource_edges` (topology graph) |
| Findings | `compliance_findings`, `security_posture`, `drift_findings`, `vulnerability_findings` |
| Cost | `cost_snapshots` (raw), `cost_rollups` (per-day precomputed aggregates) |
| Knowledge base | `kb_documents` (content-hash change detection), `kb_chunks`, `kb_embeddings` (dual vectors: legacy OpenAI 1536-dim + Bedrock Titan 1024-dim, HNSW cosine indexes) |
| Tickets | `access_tickets`, `ticket_resources`, `ticket_approvals`, `ticket_status_log` |
| Misc | `dashboards`+`widgets`, `checklists`+`checklist_items`, `audit_log`, `developer_stats`, `terraform_plans` |

Migrations live in `db/migrations` (5 to date: initial 15 tables → pgvector KB → tickets → platform
access/vulns/plans/rollups/Titan v2 column → nullable legacy embedding).

### Sync CLIs (`db/*-cli.ts`)

Thin drivers around `lib/` logic; each opens its own `max:1` postgres connection so they run under plain
`tsx` outside Next.js (the `Dockerfile.sync` toolbox image runs them on a schedule):

| CLI | What it does |
|---|---|
| `sync-cli.ts` | AWS discovery (mgmt + prod accounts) via `runSync` |
| `github-sync-cli.ts` | GitHub org discovery into the same estate tables |
| `azure-sync-cli.ts` | Azure Resource Graph discovery |
| `cost-sync-cli.ts` | AWS Cost Explorer + Azure Cost Management → snapshots + rollups |
| `kb-ingest-cli.ts` | Full KB ingest (all sources) — chunk, embed, upsert |
| `kb-reembed-cli.ts` | Backfill Titan v2 embeddings (advisory-locked, batched) |
| `seed.ts` / `migrate.ts` | Super-admin + allowlist seed; SQL migration runner |

## 7. Infrastructure & deployment

- **App image** (`Dockerfile`) — multi-stage `node:26-alpine`, Next.js standalone output, non-root
  (`nextjs:nodejs` 1001), healthcheck on `/api/health`, bundles the migration/seed toolkit
  (`scripts/migrate.mjs` / `seed.mjs`) for one-off in-VPC Fargate runs.
- **Sync image** (`Dockerfile.sync`) — toolbox with `tsx`; default CMD chains the four discovery CLIs
  (failures don't block subsequent providers). Secrets injected at runtime only.
- **CI/CD** (`Jenkinsfile`) — GitHub webhook → checkout → `npm ci` → lint + typecheck → validation build →
  (main only) `cwtEcsDeploy` image-swap deploy into `truesight-prod-cluster` (prod account
  `404063516552`, ECR `arcane-prod/truesight`), sync-image build/push (`arcane-prod/truesight-sync`), then a curl smoke
  test against `https://truesight.arcane.tech/api/health`. **No automated test stage
  exists yet.**
- **Terraform** (`deploy/terraform/`) — self-contained stack (S3 backend `truesight/prod/terraform.tfstate`):
  dedicated Fargate cluster/service (1 vCPU / 2 GB, desired 2, max 4), ALB with `/api/health` target-group
  checks, SSM SecureString secrets at `/arcane/prod/truesight/*` (placeholders, filled out-of-band), Route53 via
  the management account, and two EventBridge-scheduled Fargate tasks:
  - `truesight-prod-sync` — estate discovery, default `rate(30 minutes)`
  - `truesight-prod-kb-ingest` — KB ingest, default `rate(10 minutes)`
- **Runtime env** — non-secret config in the task definition; secrets from SSM: `DATABASE_URL`,
  `SESSION_SECRET`, admin bootstrap, `GITHUB_PAT`, AWS mgmt/prod read-only keys + role ARN, Azure service
  principal + SSO app, `OPENAI_API_KEY`, `REDIS_URL`. See `.env.example` for the full local set (including
  Bedrock model config).

## 8. Local development

```bash
cp .env.example .env.local        # fill credentials (GITHUB_PAT via `gh auth token`)
docker compose up -d            # pgvector/pgvector:pg16 (+ optional redis:7-alpine)
npm ci
npm run db:migrate
npm run db:seed                 # seeds admin / truesight-dev-2026 (DEVOPS_SUPER_ADMIN)
npm run dev                     # http://localhost:3000
```

Useful scripts: `lint`, `typecheck`, `db:generate` (drizzle-kit), `db:studio`, `db:github-sync`,
`db:azure-sync`, `db:cost-sync`, `kb:reembed`. Redis is optional — with `REDIS_URL` unset the cache uses
an in-process memory driver. Prod-image validation: `docker build -t truesight:test . && docker run --env-file
.env.local -p 3000:3000 truesight:test`.

## 9. Design system (summary)

Governed by `DESIGN.md` + `app/globals.css` tokens; Raycast-inspired, dark-only:

- Near-black canvas (`#07080a`), a 4-step **surface ladder** for elevation, hairline 1px white-alpha
  borders, **no drop shadows**, one white primary CTA.
- Signature accent **iris** `#7c8dff` (the "watching eye"); blue/red/green/yellow reserved for status
  semantics only.
- Type: Inter (body, `ss03`), Space Grotesk (display), JetBrains Mono (all machine data, tabular numerals).
- Primitives in `components/ui/` (`Surface`, `StatTile`, `DataTable`, `Badge`, `GuidedFlow`, `Reveal`, …);
  chrome in `components/nav/` (`AppChrome`, sidebar, ⌘K `CommandPalette` — "Ask Truesight").

## 10. Known documentation drift (docs vs. code)

Found during this survey — the code is authoritative:

1. **Jenkins pipeline** — README/TASKS describe a Test stage and `cwtDockerBuildPush`/`cwtHealthCheck`;
   the actual pipeline has no test stage and uses `cwtEcsDeploy` + a custom smoke test. There is no test
   suite wired into the repo at all.
2. **Task sizing** — README claims 0.25 vCPU / 0.5 GB, max 2; Terraform defaults are 1 vCPU / 2 GB,
   desired 2 / max 4 (the ~$44/mo estimate predates the resize).
3. **Sync cadence & entrypoint** — README says ~10 min via `POST /api/sync`; the scheduled task actually
   runs the standalone `Dockerfile.sync` CLIs at `rate(30 minutes)` (10 min is the KB ingest schedule).
4. **Compose image** — comments say `postgres:16`, actual image is `pgvector/pgvector:pg16` (required for
   KB embeddings).
5. **No operational runbook** — one-off migration Fargate tasks, SSM placeholder filling, ECR bootstrap,
   and `terraform apply` sequencing live only in TASKS.md Phase 8 and code comments.
