# Truesight — Task Breakdown (autonomous agentic execution)

Granular, ordered, per-task work items. **Any agent can pick a single task and ship it in isolation.**
Each task has a stable ID, the files it touches, a short description, dependencies, and explicit
**acceptance criteria** (how you know it's done).

## How to use this file

- Work phases in order (0 → 8); within a phase, respect `Depends`. Cross-phase deps are listed.
- **Global gate on every task:** `npm run typecheck` and `npm run lint` pass; no stub/mock/placeholder/"coming soon" ships; secrets never committed.
- **Real data always** — a UI task is only done when it renders real backend data (local `.env.local` real read-only creds), never fixtures.
- Legend: **Files** = create/touch · **Depends** = task IDs · **Do** = intent · **Accept** = verifiable done-criteria.

### Cross-cutting capabilities → owning tasks
Enum taxonomy → **T-1.6** · Drift engine → **T-3.3** · Docker/Jenkins parsers → **T-3.4/T-3.5** ·
Cost → **T-6.1–T-6.3** · Vulnerability scanner → **T-6.4–T-6.6** · Nil-traffic/orphan → **T-6.7** ·
Guided governance workflows + verified checklist → **T-6.8** · SSO slot → **T-7.6**.

---

## Phase 0 — Docs (autonomous-execution enabler)

### T-0.1 — Repo README
- **Files:** `README.md`
- **Depends:** —
- **Do:** Authoritative overview: positioning, 7 pillars, read-only principle, architecture, stack table, structure, local dev, integrations/security, deployment, conventions.
- **Accept:** README renders all sections; links to `docs/TASKS.md`; stack versions match `package.json`; overwrites the one-line stub.

### T-0.2 — Task breakdown
- **Files:** `docs/TASKS.md`
- **Depends:** T-0.1
- **Do:** This file — phased, granular tasks with IDs, files, deps, acceptance criteria, and a Definition of Done.
- **Accept:** Every pillar/adapter/cross-cutting item has ≥1 task with acceptance criteria; ends with Definition of Done.

---

## Phase 1 — Foundation

**Phase gate:** admin login works locally against the real Postgres DB; `/api/health` green.

### T-1.1 — App scaffold + route groups
- **Files:** `app/(marketing)/`, `app/(auth)/`, `app/(app)/`, `app/layout.tsx`, `app/api/`
- **Depends:** —
- **Do:** Create App Router route groups + shared root layout (fonts, providers). Placeholder pages replaced by real ones in later phases.
- **Accept:** `npm run dev` boots; `/` (marketing) and `/login` route resolve; typecheck passes.

### T-1.2 — Design tokens (`@theme`)
- **Files:** `app/globals.css`, `postcss.config.mjs`
- **Depends:** T-1.1
- **Do:** Encode DESIGN.md tokens 1:1 as Tailwind v4 `@theme`; `body` sets `font-feature-settings:"calt","kern","liga","ss03"`. No `shadow-*` utilities used anywhere.
- **Accept:** Canvas `#07080a`, hairline `#242728` borders resolve as CSS vars; `grep -r "shadow-" app components` returns nothing; Inter `ss03` active.

### T-1.3 — Core UI primitives
- **Files:** `components/ui/Surface.tsx` (exists), `Button.tsx`, `Keycap.tsx`, `Reveal.tsx`, `Badge.tsx`, `PillTabs.tsx`, `TextInput.tsx`
- **Depends:** T-1.2
- **Do:** Elevation via `<Surface level={0..3}>` ladder (canvas→surface→elevated→card); white CTA pill `Button`; `Reveal` spring wrapper. Map 1:1 to DESIGN.md.
- **Accept:** Surface renders 4 distinct levels without shadows; Button matches spec; components typecheck and render in a scratch page.

### T-1.4 — Logo, icon set, aperture state
- **Files:** `components/brand/TruesightLogo.tsx`, `components/estate/AppIconTile.tsx`, `components/brand/ApertureState.tsx`
- **Depends:** T-1.3, T-1.6
- **Do:** Custom iris/aperture mark (concentric hairline arcs + pupil); `ResourceKind`-mapped glyph tinted with provider accent inside `AppIconTile` (only saturation in system); ambient aperture "watching" animation.
- **Accept:** Logo renders as favicon + ⌘K icon; `AppIconTile` tints per `ResourceKind` from taxonomy; aperture animates and honors reduced-motion.

### T-1.5 — App shell (Sidebar / TopBar / ⌘K)
- **Files:** `components/nav/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `components/command/CommandPalette.tsx`
- **Depends:** T-1.3
- **Do:** Persistent shell for `(app)/*`; ⌘K opens `cmdk` palette (search wired later in T-2.8).
- **Accept:** Shell renders nav to all pillar routes; ⌘K / Cmd-K opens/closes palette; keyboard nav works.

### T-1.6 — Canonical taxonomy
- **Files:** `lib/taxonomy/index.ts`, `lib/taxonomy/aws.ts`, `lib/taxonomy/azure.ts`
- **Depends:** —
- **Do:** Enums `CloudProvider`, `ResourceKind`, `DriftStatus`, `Severity`, `ServiceCategory`, `PipelineStageKind` + per-provider mapping tables. Shared by integrations AND UI.
- **Accept:** Enums exported and typed; AWS + Azure native-type → `ResourceKind` maps present; importable from both `lib/integrations/*` and `components/*`; typecheck passes.

### T-1.7 — Env config
- **Files:** `lib/config/env.ts`, `.env.example`
- **Depends:** —
- **Do:** `zod`-parsed env (DB URL, session secret, admin creds, AWS/Azure/GitHub creds + role ARNs, `REDIS_URL?`). Fail fast on missing required in prod.
- **Accept:** Importing config with a complete `.env.local` succeeds; missing required var throws a clear error; `.env.example` lists every key (no values).

### T-1.8 — Cache layer
- **Files:** `lib/cache/cached.ts`, `lib/cache/driver.ts`, `lib/cache/memory.ts`, `lib/cache/redis.ts`
- **Depends:** T-1.7
- **Do:** `cacheable(key, ttl, tags, fetcher)` over a driver interface; `MemoryCacheDriver` default, `RedisCacheDriver` when `REDIS_URL` set. Tag-based invalidation.
- **Accept:** Second call within TTL skips fetcher; tag invalidation clears entries; driver auto-selects by `REDIS_URL`; unit-verifiable via a scratch call.

### T-1.9 — KB schema
- **Files:** `db/schema.ts`, `drizzle.config.ts`
- **Depends:** T-1.6
- **Do:** Drizzle tables: `users`/`user_roles`; `integration_accounts`/`integration_sync`; `resource_snapshots` (append-only) + `resources` (materialized) + `resource_edges` (GIN on tags/attributes); `compliance_findings`, `security_posture`, `drift_findings`, `cost_snapshots`, `checklists`/`checklist_items`; `dashboards`/`widgets`; `audit_log`.
- **Accept:** `npm run db:generate` produces migrations with no errors; schema compiles; `urn` present on resource tables.

### T-1.10 — Migrate + seed admin
- **Files:** `db/migrate.ts`, `db/seed.ts`, `db/migrations/*`
- **Depends:** T-1.9
- **Do:** `db:migrate` applies migrations (used as one-off task, never at boot); `db:seed` inserts admin `admin` / `truesight-dev-2026` (bcrypt) role `DEVOPS_SUPER_ADMIN`.
- **Accept:** Against local `docker compose` Postgres, `npm run db:migrate && npm run db:seed` succeed; `users` has one bcrypt-hashed admin row.

### T-1.11 — Session (jose JWT)
- **Files:** `lib/auth/session.ts`
- **Depends:** T-1.7
- **Do:** Sign compact HS256 JWT (`SESSION_SECRET`) → httpOnly `Secure` `SameSite=Lax` cookie `truesight_session`, 8h sliding; `getSession()` / `setSession()` / `clearSession()`.
- **Accept:** `setSession` writes `truesight_session` cookie with correct flags; `getSession` verifies + returns `AuthedUser`; tampered/expired token → null.

### T-1.12 — Auth providers + RBAC
- **Files:** `lib/auth/providers/types.ts`, `credentials.ts`, `azure-entra.ts` (stub slot), `lib/auth/rbac.ts`
- **Depends:** T-1.10, T-1.11
- **Do:** `AuthProvider` interface returning `AuthedUser`; `credentials` verifies bcrypt against DB; `azure-entra.ts` implements the same interface (wired in T-7.6); `can(role, action)`.
- **Accept:** Correct creds → `AuthedUser`; wrong creds → rejected; `can('DEVOPS_SUPER_ADMIN', 'sync')` → true; `azure-entra` satisfies the interface type.

### T-1.13 — Route protection middleware
- **Files:** `middleware.ts`
- **Depends:** T-1.11
- **Do:** Guard `(app)/*` + `/api/*` except `/api/health` and auth routes; redirect unauthenticated app routes to `/login`, return 401 for protected APIs.
- **Accept:** No cookie → `/aws` redirects to `/login`; protected `/api/*` returns 401; `/api/health` and `/login` reachable without cookie.

### T-1.14 — Login page + action
- **Files:** `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`
- **Depends:** T-1.12, T-1.13, T-1.3
- **Do:** Minimal-content login using UI primitives; Server Action authenticates via credentials provider, sets session, redirects to app.
- **Accept:** Admin login sets `truesight_session` cookie and lands on an app route; invalid login shows an inline error; logout clears cookie.

### T-1.15 — Health endpoint
- **Files:** `app/api/health/route.ts`
- **Depends:** T-1.9
- **Do:** Unauthenticated handler returning `{ status: 'ok', db: 'ok'|'down' }` after a lightweight DB ping.
- **Accept:** `curl localhost:3000/api/health` → `200 {status:"ok",db:"ok"}` with DB up; `db:"down"` when DB unreachable (still 200 for LB semantics per plan, or documented).

### T-1.16 — Container + local infra + gitignore
- **Files:** `Dockerfile`, `docker-compose.yml`, `.gitignore`, `.dockerignore`
- **Depends:** T-1.1, T-1.15
- **Do:** Multi-stage `node:26-alpine` (deps → builder `npm run build` → non-root `nextjs` runner copying `.next/standalone`+`static`+`public`, `HEALTHCHECK /api/health`, `CMD node server.js`). Compose: postgres:16 (+ optional redis:7). Node/Next `.gitignore` (`.env*`, `node_modules`, `.next`, `deploy/terraform/.terraform`, `*.tfstate*`).
- **Accept:** `docker build -t truesight:test .` succeeds; `docker run --env-file .env.local -p 3000:3000 truesight:test` serves `/api/health` 200; `git status` never shows `.env.local`.

### T-1.17 — Bootstrap GitHub PAT
- **Files:** `.env.local` (local, gitignored)
- **Depends:** T-1.7
- **Do:** `gh auth token` → write `GITHUB_PAT=` into `.env.local` (scopes `repo`, `read:org`, `workflow`).
- **Accept:** `GITHUB_PAT` present in local env; `.env.local` gitignored; a `gh api /user` style check authenticates.

---

## Phase 2 — AWS explorer + taxonomy

**Phase gate:** AWS explorer renders ≥1 real resource from the prod account.

### T-2.1 — Integration contracts
- **Files:** `lib/integrations/types.ts`
- **Depends:** T-1.6
- **Do:** `IntegrationAdapter { healthCheck(); discover(): DiscoveryResult }`; `DiscoveryResult { resources, edges, partial, errors }`; unified `CloudResource` keyed by `urn` (`provider:account:region:service:nativeId`); `create*Adapter(cfg)` factory shape (no module state).
- **Accept:** Types compile; `urn` builder + parser round-trip; imported by AWS adapter without cycles.

### T-2.2 — AWS read-only client factory
- **Files:** `lib/integrations/aws/client.ts`
- **Depends:** T-2.1, T-1.7
- **Do:** STS `AssumeRole` (mgmt base creds → `truesight-readonly`/`ViewOnlyAccess` per account) via `fromTemporaryCredentials`; memoized v3 client factory (`retryMode:'adaptive'`).
- **Accept:** Returns scoped clients per account×region; assumes `truesight-readonly` (verified via STS `GetCallerIdentity`); no write-capable client constructed; creds memoized (no re-assume per call).

### T-2.3 — AWS discovery adapter
- **Files:** `lib/integrations/aws/adapter.ts`, `lib/integrations/aws/describe.ts`
- **Depends:** T-2.2
- **Do:** `resource-groups-tagging-api GetResources` inventory, then targeted describes for present types (ECR/ECS/S3/RDS/DocumentDB/SSM/Bedrock/EC2-VPC); v3 paginators; `p-limit` ≤5 concurrent per account×region; `Promise.allSettled` isolation; map to `CloudResource` via taxonomy.
- **Accept:** `discover()` against prod returns ≥1 real `CloudResource` with valid `urn` + `ResourceKind`; one failing scope yields `partial:true` + an `errors` entry, not a throw.

### T-2.4 — Sync orchestrator
- **Files:** `lib/integrations/sync/orchestrator.ts`
- **Depends:** T-2.3, T-1.8, T-1.9
- **Do:** `runSync()` → local mutex (Redis lock when multi-task) → `adapter.discover()` → upsert `resource_snapshots` + reconcile `resources`/`resource_edges` → write `integration_sync` row → refresh graph cache.
- **Accept:** One `runSync()` populates `resources` from real discovery; `integration_sync` row records counts/timestamp; concurrent invocations serialize via mutex.

### T-2.5 — Sync API + refresh control
- **Files:** `app/api/sync/route.ts`, `components/nav/RefreshButton.tsx`
- **Depends:** T-2.4, T-1.13
- **Do:** Admin-only `POST /api/sync` triggers `runSync()`; TopBar refresh button calls it and reflects progress.
- **Accept:** Authenticated POST returns sync summary and updates DB; unauthenticated → 401; button shows in-progress → done state.

### T-2.6 — Estate components
- **Files:** `components/estate/AccountTile.tsx`, `RegionGroup.tsx`, `ServiceTile.tsx`, `ResourceDrawer.tsx`
- **Depends:** T-2.4, T-1.4
- **Do:** Visual-first account/region/service tiles that materialize on discovery (spring reveal, stagger); tables are drill-down only (TanStack Table in a drawer).
- **Accept:** Tiles render from real `resources`; materialization animates with stagger; drill-down drawer shows real resource attributes; reduced-motion → instant.

### T-2.7 — AWS explorer route
- **Files:** `app/(app)/aws/page.tsx`, `app/(app)/aws/loading.tsx`
- **Depends:** T-2.6, T-2.5
- **Do:** RSC reads cache-first → latest snapshot; renders estate tiles; degrade-never-blank banner on partial.
- **Accept:** `/aws` renders ≥1 real prod resource; partial discovery shows "degraded — N scopes unavailable" not a blank/broken screen; first paint immediate.

### T-2.8 — "Ask Truesight" search
- **Files:** `components/command/CommandPalette.tsx`, `app/api/search/route.ts`
- **Depends:** T-2.7, T-1.5
- **Do:** ⌘K palette searches real resources (by name/kind/account/tag) with suggestion chips ("Show drifted resources in prod", "Where's my spend going?").
- **Accept:** Typing a real resource name returns it and navigates on select; chips issue real queries; empty query shows suggestions.

---

## Phase 3 — Terraform + topology (signature)

**Phase gate:** topology renders real nodes with real drift overlays.

### T-3.1 — Terraform state reader
- **Files:** `lib/integrations/terraform/state.ts`
- **Depends:** T-2.1, T-2.2
- **Do:** `@aws-sdk/client-s3 GetObject` state from `terraform-iac-data` (keys `keystone/cwt-*`, `nr-platform/*`, `file-upload-s3/dev`); parse resources → `urn`. Read-only, never locks.
- **Accept:** Reads a real state key and yields managed resources keyed by `urn`; only `s3:GetObject` used; no lock-table access.

### T-3.2 — HCL structure parser
- **Files:** `lib/integrations/terraform/hcl.ts`
- **Depends:** T-2.1
- **Do:** `@cdktf/hcl2json` over module HCL → module/resource structure for the canvas (`ModuleNode`s).
- **Accept:** Parses a real module dir into module→resource tree; server-external package not bundled client-side.

### T-3.3 — Drift engine
- **Files:** `lib/integrations/terraform/drift.ts`
- **Depends:** T-3.1, T-2.3
- **Do:** Join state ↔ live cloud by `urn` → `IN_SYNC` / `DRIFTED` / `MISSING_IN_CLOUD` (ghost) / `UNMANAGED` (orphan). Read-only classification, no `plan`.
- **Accept:** Produces `drift_findings` with correct status per `urn`; a known synced resource classifies `IN_SYNC`; an unmanaged live resource classifies `UNMANAGED`; zero mutation calls.

### T-3.4 — Dockerfile parser
- **Files:** `lib/integrations/repo/dockerfile.ts`
- **Depends:** T-1.6
- **Do:** Parse `FROM`/stages/`EXPOSE`/`ARG` → `DockerStageNode` graph nodes.
- **Accept:** Multi-stage Dockerfile yields ordered stage nodes with base images + exposed ports.

### T-3.5 — Jenkinsfile parser
- **Files:** `lib/integrations/repo/jenkinsfile.ts`
- **Depends:** T-1.6
- **Do:** Parse declarative `stage('…')` blocks → `PipelineStageKind` → `JenkinsStageNode`s.
- **Accept:** A real declarative Jenkinsfile yields ordered pipeline-stage nodes mapped to `PipelineStageKind`.

### T-3.6 — Graph merge + layout
- **Files:** `lib/topology/graph.ts`, `lib/topology/layout.ts`
- **Depends:** T-3.1, T-3.2, T-3.3, T-3.4, T-3.5, T-2.4
- **Do:** Merge live resources + TF modules + repo-artifact nodes into RF nodes/edges (`deployed-from` edges linking artifacts → live resources); ELK `layered` (RIGHT, orthogonal) computed server-side. Deterministic (sorted keys, content-hashed IDs).
- **Accept:** Same input → identical node IDs/order (deterministic); ELK positions computed server-side; artifact→resource edges present.

### T-3.7 — Topology APIs
- **Files:** `app/api/topology/graph/route.ts`, `app/api/topology/stream/route.ts`
- **Depends:** T-3.6
- **Do:** `graph` returns laid-out graph (cache-first); `stream` is an SSE endpoint emitting real discovery progress deltas.
- **Accept:** `graph` returns nodes/edges with positions; `stream` emits `text/event-stream` progress events during a live sync; both auth-guarded.

### T-3.8 — Topology canvas
- **Files:** `components/topology/TopologyCanvas.tsx`, `components/topology/nodes/*`, `components/topology/edges/*`
- **Depends:** T-3.7, T-1.4
- **Do:** Client island; node types `AccountGroupNode`/`RegionGroupNode` (RF parent groups), `ResourceNode` (surface-card, provider-accent glyph, left status rail), `ModuleNode`, `DockerStageNode`, `TfModuleNode`, `JenkinsStageNode`.
- **Accept:** `/topology` renders real merged graph; group nesting correct; hover lifts a node one ladder notch + highlights connected edges.

### T-3.9 — Entrance motion + drift overlays
- **Files:** `components/topology/TopologyCanvas.tsx`, `components/topology/DriftOverlay.tsx`
- **Depends:** T-3.8, T-3.3
- **Do:** Backend-driven scanning sweep via SSE: groups fade+scale (spring 120/18) → resources stagger per account (40ms) → edges draw `pathLength` 0→1. Drift overlays: green in-sync / yellow-ring drift / red missing. Reduced-motion → instant.
- **Accept:** Entrance plays against real SSE progress (not a canned loop); drift colors match `drift_findings`; `prefers-reduced-motion` collapses to instant reveal.

### T-3.10 — Drift dashboard
- **Files:** `app/(app)/topology/drift/page.tsx`, `components/widgets/DriftGauge.tsx`
- **Depends:** T-3.3
- **Do:** Tabular + gauge summary of drift status counts, filterable by account/status, linking to canvas nodes.
- **Accept:** Counts reconcile with `drift_findings`; row click focuses the node on the canvas.

---

## Phase 4 — Azure explorer

### T-4.1 — Azure client
- **Files:** `lib/integrations/azure/client.ts`
- **Depends:** T-2.1, T-1.7
- **Do:** `@azure/identity` `ClientSecretCredential` (SP); resolve `Arcane-Prod` subscription GUID by displayName at runtime.
- **Accept:** Authenticates read-only; resolves sub GUID by name; `serverExternalPackages` keeps `@azure/identity` server-side.

### T-4.2 — Azure adapter
- **Files:** `lib/integrations/azure/adapter.ts`
- **Depends:** T-4.1
- **Do:** `@azure/arm-resourcegraph` single KQL over `rg-arcane-prod` → `CloudResource` via taxonomy mapping.
- **Accept:** `discover()` returns ≥1 real Azure resource with valid `urn` + `ResourceKind`; partial/errors handled like AWS.

### T-4.3 — Azure explorer route
- **Files:** `app/(app)/azure/page.tsx`
- **Depends:** T-4.2, T-2.6
- **Do:** Reuse estate components at parity with AWS.
- **Accept:** `/azure` renders ≥1 real resource from `rg-arcane-prod` using the same tile components; degrade-never-blank banner honored.

---

## Phase 5 — GitHub insights

### T-5.1 — GitHub client
- **Files:** `lib/integrations/github/client.ts`
- **Depends:** T-2.1, T-1.17
- **Do:** `octokit` + `@octokit/graphql` + throttling/retry plugins using `GITHUB_PAT`.
- **Accept:** Authenticated `octokit` reaches `arcane`; throttling plugin active; PAT read from env only.

### T-5.2 — GitHub adapter
- **Files:** `lib/integrations/github/adapter.ts`
- **Depends:** T-5.1, T-1.8
- **Do:** REST enum Team→Member→Repo; GraphQL insights (languages, commit counts, top devs); cache 60m (rate-limit hotspot).
- **Accept:** Returns real teams→members→repos for the org; insights populated; cached 60m; no rate-limit crash on repeat.

### T-5.3 — GitHub insights route
- **Files:** `app/(app)/github/page.tsx`, `components/widgets/TopDevs.tsx`, `LanguageBar.tsx`
- **Depends:** T-5.2, T-1.3
- **Do:** Visual-first Team→Member→Repo drilldown + insight widgets.
- **Accept:** `/github` renders real org data (≥1 team, members, repos, languages, top devs); drilldown works.

---

## Phase 6 — Cost + Security/Vuln + Compliance/KB

### T-6.1 — AWS cost
- **Files:** `lib/integrations/aws/cost.ts`
- **Depends:** T-2.2, T-1.8
- **Do:** `@aws-sdk/client-cost-explorer GetCostAndUsage`, GroupBy SERVICE/tag, time filter; cache hard ($0.01/req); write `cost_snapshots`.
- **Accept:** Returns real prod cost grouped by service and by tag over a time range; results cached; calls minimized.

### T-6.2 — Azure cost
- **Files:** `lib/integrations/azure/cost.ts`
- **Depends:** T-4.1, T-1.8
- **Do:** `@azure/arm-costmanagement` query → `cost_snapshots` parity.
- **Accept:** Returns real Azure spend by service/tag × time; merges with AWS in the dashboard.

### T-6.3 — Cost dashboard
- **Files:** `app/(app)/cost/page.tsx`, `components/widgets/CostTile.tsx`, `Sparkline.tsx`
- **Depends:** T-6.1, T-6.2
- **Do:** Real-time, filterable by **product/tag × time**; number roll-ups; leverages `Owner`/`Team`/`Project` default tags for attribution.
- **Accept:** `/cost` shows real combined AWS+Azure spend; product/tag and time filters change values; roll-up animation runs.

### T-6.4 — AWS vulnerability scanner
- **Files:** `lib/integrations/aws/vuln.ts`
- **Depends:** T-2.2
- **Do:** `@aws-sdk/client-inspector2` + ECR `DescribeImageScanFindings` + `@aws-sdk/client-securityhub`; each finding → resource link, detail, **remediation text**; write `security_posture`.
- **Accept:** Returns real findings with severity (mapped to `Severity`), resource `urn`, and remediation text; empty scopes handled gracefully.

### T-6.5 — Azure Defender
- **Files:** `lib/integrations/azure/vuln.ts`
- **Depends:** T-4.1
- **Do:** Resource Graph `securityresources` KQL → findings parity with AWS.
- **Accept:** Returns real Defender findings mapped to `Severity` + `urn`, merged into `security_posture`.

### T-6.6 — Security/vuln UI + configurable sync
- **Files:** `app/(app)/security/page.tsx`, `components/widgets/VulnCounter.tsx`, `app/api/settings/scan-frequency/route.ts`
- **Depends:** T-6.4, T-6.5, T-1.9
- **Do:** Findings list + severity counters; **sync frequency configurable** (DB-stored).
- **Accept:** `/security` renders real findings with remediation; changing scan frequency persists to DB and affects the scheduled sync.

### T-6.7 — Nil-traffic & orphan detection
- **Files:** `lib/integrations/aws/nil-traffic.ts`, `lib/integrations/aws/orphans.ts`
- **Depends:** T-2.2
- **Do:** CloudWatch `GetMetricData` (~0 traffic over N days) + orphan detection (unattached EBS/EIP, idle ELBs). Surfaced in Cost/Security.
- **Accept:** Flags ≥ correct set of idle/orphan resources against real metrics; surfaced as findings + cost-waste callouts.

### T-6.8 — Compliance / guided workflows / verified checklist
- **Files:** `app/(app)/compliance/page.tsx`, `components/governance/GuidedFlow.tsx`, `VerifiedChecklist.tsx`, `lib/governance/*`
- **Depends:** T-1.9, T-3.3, T-6.4
- **Do:** Governance as status-tracked, traceable, step-based flows with a centralized verified-checklist (✓ per control across the estate); configurable checklists/dashboards for extensibility (Digio "OS of Trust" pattern).
- **Accept:** `/compliance` renders real checklist state backed by `checklists`/`checklist_items`; a control's ✓/✗ reflects real findings (drift/vuln); flow steps track status and are traceable.

### T-6.9 — Dashboards / widgets kit
- **Files:** `components/widgets/*`, `app/(app)/dashboard/page.tsx`
- **Depends:** T-1.9, T-6.3, T-6.6
- **Do:** Configurable `dashboards`/`widgets` (cost tiles, drift gauges, vuln counters, sparklines) with spring reveals / number roll-ups.
- **Accept:** Widgets render real data; dashboard layout persists to DB; roll-ups animate; reduced-motion honored.

---

## Phase 7 — Landing narrative + motion polish

### T-7.1 — Landing hero
- **Files:** `app/(marketing)/page.tsx`, `components/marketing/Hero.tsx`
- **Depends:** T-1.4
- **Do:** Minimal-content, motion-first hero (short verb-led headline + one supporting line; one primary visual + one CTA). No gradient hero, no 01/02/03 markers.
- **Accept:** Hero matches hazel-style low density; CTA routes to login; no slop defaults; Lighthouse a11y ≥ 90.

### T-7.2 — Capability showcase
- **Files:** `components/marketing/CapabilityShowcase.tsx`
- **Depends:** T-7.1
- **Do:** Auto-cycling segmented tabs (Discover · Visualize · Detect drift · Optimize cost · Secure), each synced to its own motion graphic.
- **Accept:** Tabs auto-cycle and are manually selectable; each mode shows a distinct real-data-representative motion graphic.

### T-7.3 — Aperture scanning state (SSE-driven)
- **Files:** `components/brand/ApertureState.tsx`, `components/topology/ScanningOverlay.tsx`
- **Depends:** T-3.7, T-1.4
- **Do:** Procedural aperture pulsing/sweeping **driven by real `/api/topology/stream` discovery progress** (Rive/Lottie for ambient; SVG/Canvas for data flows), with voice ("Truesight is watching 3 accounts…").
- **Accept:** Sweep advances with real SSE events (not a fixed loop); progress copy reflects actual counts; reduced-motion → static.

### T-7.4 — Data-flow motion pass
- **Files:** `components/topology/edges/*`
- **Depends:** T-3.8
- **Do:** Steady-state data-flow motion along active edges + live-state pulses (motion as information channel).
- **Accept:** Active edges animate flow; inactive edges static; performance smooth on the real prod graph.

### T-7.5 — Empty/error voice + a11y + reduced-motion floor
- **Files:** `components/ui/EmptyState.tsx`, `ErrorState.tsx`, `app/globals.css`
- **Depends:** T-2.7, T-4.3, T-5.3, T-6.*
- **Do:** Consistent degraded/empty/error voice across pillars; a11y floor (focus rings, contrast, labels); global `prefers-reduced-motion` handling.
- **Accept:** Every pillar route has non-blank empty/error states; keyboard-navigable; reduced-motion disables non-essential animation site-wide.

### T-7.6 — Wire Azure Entra SSO slot
- **Files:** `lib/auth/providers/azure-entra.ts`, `app/(auth)/login/page.tsx`
- **Depends:** T-1.12
- **Do:** Implement `azure-entra` against the `AuthProvider` interface (OIDC) returning the same `AuthedUser`; expose as login option (credentials remains default).
- **Accept:** Entra provider satisfies the interface and returns `AuthedUser`; credential login unaffected; SSO path togglable by config.

---

## Phase 8 — Provision + go live (gated)

**Do NOT apply until full local verification + human review of `terraform plan`.**

### T-8.1 — TF data + remote state
- **Files:** `deploy/terraform/main.tf`, `variables.tf`, `data.tf`, `backend`
- **Depends:** Phases 1–7 verified locally
- **Do:** Backend `s3://terraform-iac-data` key `truesight/prod/terraform.tfstate`, lock `keystone-terraform-locks`; providers prod (assume `OrganizationAccountAccessRole` in 404063516552) + `management` alias (664224997032); `default_tags` = Owner/Team/Project/Environment/ManagedBy; `terraform_remote_state` VPC + regional ACM lookup.
- **Accept:** `terraform init` + `plan` succeed reading (not writing) VPC outputs; default tags present on planned resources.

### T-8.2 — ECR
- **Files:** `deploy/terraform/ecr.tf`
- **Depends:** T-8.1
- **Do:** ECR repo `arcane-prod/truesight`, `scan_on_push=true`, lifecycle keep-10.
- **Accept:** `plan` creates only the `truesight` ECR repo with scan + lifecycle.

### T-8.3 — IAM
- **Files:** `deploy/terraform/iam.tf`
- **Depends:** T-8.1
- **Do:** ECS exec + task roles; task role scoped to `ssm:GetParameters*` on `/arcane/prod/truesight/*` + `kms:Decrypt` + cross-account `sts:AssumeRole` to `truesight-readonly`.
- **Accept:** `plan` shows least-privilege task role (no write to estate); assume-role target is `truesight-readonly` only.

### T-8.4 — Security groups
- **Files:** `deploy/terraform/security-groups.tf`
- **Depends:** T-8.1
- **Do:** `truesight-ecs-sg`, `truesight-alb-sg`, RDS SG (5432 from ecs-sg only).
- **Accept:** `plan` restricts RDS ingress to ecs-sg; ALB SG allows 80/443 only.

### T-8.5 — RDS
- **Files:** `deploy/terraform/rds.tf`
- **Depends:** T-8.1, T-8.4
- **Do:** `db.t4g.micro` in DATA subnets.
- **Accept:** `plan` provisions t4g.micro in private data subnets, SG from T-8.4.

### T-8.6 — ALB
- **Files:** `deploy/terraform/alb.tf`
- **Depends:** T-8.1, T-8.4
- **Do:** Small dedicated ALB, TG :3000, HTTPS :443 (regional ACM `*.arcane.tech`), :80→443 redirect, health `/api/health`.
- **Accept:** `plan` creates ALB + TG + listeners with health check path `/api/health`.

### T-8.7 — ECS service
- **Files:** `deploy/terraform/ecs.tf`
- **Depends:** T-8.2, T-8.3, T-8.5, T-8.6
- **Do:** `truesight-prod-cluster` + ecs-service module (git-sourced ref): cpu 256/mem 512, desired 1/max 2, on-demand, private subnets, secrets from SSM, health `/api/health`.
- **Accept:** `plan` creates cluster + service wired to TG; secrets reference `/arcane/prod/truesight/*`; on-demand capacity.

### T-8.8 — DNS
- **Files:** `deploy/terraform/dns.tf`
- **Depends:** T-8.6
- **Do:** Route53 A/ALIAS `truesight…` → ALB via `aws.management` alias (zone `Z08590081H9KT0BUGB1O9`).
- **Accept:** `plan` creates the record through the management provider alias only.

### T-8.9 — Monitoring
- **Files:** `deploy/terraform/monitoring.tf`
- **Depends:** T-8.6, T-8.7, T-8.5
- **Do:** CW alarms: ALB 5xx, TG unhealthy, ECS CPU/mem, RDS.
- **Accept:** `plan` creates the listed alarms.

### T-8.10 — SSM secrets
- **Files:** `deploy/terraform/ssm.tf`
- **Depends:** T-8.1
- **Do:** SecureString placeholders under `/arcane/prod/truesight/*` (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, AWS/Azure creds + `role_arn`s, `GITHUB_PAT`) with `lifecycle{ignore_changes=[value]}`; String build-args under `/arcane/prod/truesight/build-args/`. Real values filled out-of-band from `.env.local`.
- **Accept:** `plan` creates placeholders with `ignore_changes`; no real secret value in code/state diff.

### T-8.11 — truesight-readonly role
- **Files:** `deploy/terraform/readonly-role/*` (or documented manual trust)
- **Depends:** T-8.1
- **Do:** Provision `truesight-readonly` (AWS-managed `ViewOnlyAccess`) in prod + dev with trust to the task role.
- **Accept:** Role exists/planned with ViewOnlyAccess + correct trust; task role can assume it (verified post-apply via `GetCallerIdentity`).

### T-8.12 — Jenkins pipeline + registration
- **Files:** `Jenkinsfile`, `services/truesight.yaml` (jenkins-terraform repo)
- **Depends:** T-1.16
- **Do:** `@Library('cwt-jenkins-library')`, `GitHubPushTrigger` webhook, `agent{label 'docker'}`; stages Checkout → Install → Lint & Typecheck → Test → Build → Resolve Env (main→prod) → `cwtDockerBuildPush` → `cwtEcsDeploy` → `cwtHealthCheck` → live smoke test.
- **Accept:** A push to `main` triggers the pipeline; build+push+deploy+health stages green; migrations run as a one-off task, not at boot.

### T-8.13 — Scheduled sync task
- **Files:** `deploy/terraform/scheduler.tf`
- **Depends:** T-8.7
- **Do:** EventBridge ECS Scheduled Task (~10 min) hitting the sync entrypoint (`runSync()`).
- **Accept:** `plan` creates the schedule; post-apply, `integration_sync` rows appear on cadence.

### T-8.14 — Apply + live verification
- **Files:** — (operational)
- **Depends:** T-8.1–T-8.13
- **Do:** After human review of `plan`: apply foundation → RDS → first image → ECS+ALB → Route53; run the live checklist.
- **Accept:** See **Definition of Done** below — all live checks pass; `terraform plan` post-apply shows zero drift and touches only `truesight-*` resources (proves no estate modification); monthly cost projection ≤ $50.

---

## Definition of Done (comprehensive shipping)

Truesight is shipped only when **every route on the live URL renders fully-verified, real, working data —
no stub, placeholder, mock, or "coming soon" on any route.**

**Live checks (all must pass):**
- `dig truesight.arcane.tech` resolves to the ALB.
- `curl -sSI https://truesight.arcane.tech/` → `200`; TLS chain valid (SAN `*.arcane.tech`, TLS 1.2+).
- `/api/health` → `{status:ok, db:ok}`.
- `aws ecs describe-services` → running == desired.
- Admin login works; protected routes return 401 without the `truesight_session` cookie.
- **`terraform plan` shows zero drift and touches only `truesight-*` resources** (proves no estate modification).
- Monthly cost projection ≤ $50 (~$44 target).

**Walk every route and confirm real backend data + working motion:**
`(marketing)` landing · `/login` · `/aws` · `/azure` · `/topology` (+ drift) · `/github` · `/cost` ·
`/security` · `/compliance` (checklists).

**Per-route bar:** real non-empty data from live integrations; degrade-never-blank on partial; motion
plays (and reduced-motion collapses cleanly); no console errors; no stub/mock/placeholder text anywhere.
