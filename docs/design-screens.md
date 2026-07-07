# Truesight — screen blueprints

How the shipped Truesight product composes its screens from the design system. When asked to design an Truesight screen (or one "like Truesight"), follow these compositions — they mirror the production app.

## App chrome (every authenticated screen)

- **Sidebar** (left, fixed ~240px, `bg-surface` + right hairline): the Truesight wordmark, then a vertical nav — Overview, AWS estate, Azure estate, Topology, GitHub, Cost, Security, Compliance, Plans, Developers, Tickets, Knowledge Base, Settings. Active item gets `bg-surface-elevated text-ink`; inactive `text-mute`. Each item is icon + label (lucide icons).
- **Top bar** (h-14, hairline bottom): breadcrumb on the left (`text-mute` → `text-ink` for current), right side holds a ⌘K hint (`Keycap` pair: ⌘ K) and screen-level actions.
- **Content** sits on `bg-canvas` with `p-8`, starts with `PageHeader`.
- Dark-only. No footer inside the app.

## Screen recipes

### Overview (the landing dashboard)
`PageHeader` (eyebrow "Estate", title "Overview", action: primary "Run sync" sm). Then a 4-up `StatTile` grid (gap-4): Resources (delta), Integrations, Drift findings (deltaInverted), Monthly spend (prefix "$", deltaInverted, sparkline). Below: two-column split — left `Surface level={1}` panel with a `Timeline` (variant "status") of recent sync events; right column stacks a `VerifiedChecklist` (compliance snapshot) and a sync-health `Surface` card with `StatusBadge` rows per provider (`ProviderChip` + last-sync `font-mono` timestamp).

### AWS estate / Azure estate
`PageHeader` (title "AWS estate", description with account count). A row of account summary `Surface level={1}` cards (account name, `font-mono` account id, resource count via `RollupNumber`, `StatusBadge`). Then the **resource explorer**: `FilterBar` (search + PROVIDER/ENVIRONMENT/SERVICE facets with counts) above a `DataTable` — columns: Name (`font-mono`), Service, Type, Region, Environment (`Badge`), Status (`StatusBadge`), Last seen (`font-mono`, muted). Rows are dense; pagination footer at 25/page. Azure is identical with resource-group cards.

### Topology
Full-bleed canvas (no PageHeader padding): a toolbar strip (`PillTabs` for env scope: All/Prod/Dev/UAT, provider filter, layout toggle) above a dark graph canvas of resource nodes (rounded `Surface level={2}` mini-cards: `AppIconTile` 48 + name + `StatusBadge` dot) connected by hairline edges; drift-affected nodes ring in the warning accent. A right-side `Drawer`-style detail panel opens on node select.

### Cost
`PageHeader` (eyebrow "FinOps", title "Cost", action: "Run cost sync" tertiary sm). `PillTabs` range filter (7d / 30d / 90d / MTD). 4-up `StatTile` row: Total spend, Delta vs previous (deltaInverted, "%"), Top service, Daily burn (sparkline). Below: `Surface level={1}` breakdown panel — horizontal bar rows per service (label, `font-mono` amount, proportional iris-soft bar) — and a line-items `DataTable` (Service, Account, Product tag, Amount `font-mono` right-aligned, Period).

### Security
`PageHeader` (title "Security", description with open-findings count). `StatTile` row: Open findings, Critical (deltaInverted), Exposed resources, Sources. Severity breakdown as `StatusBadge` chips with counts. Findings `DataTable`: Severity (`StatusBadge`), Title, Source (`Badge` — dependabot/inspector/defender), Package/Resource (`font-mono`), CVE (`font-mono`), Last seen. `FilterBar` on top (severity/source/provider facets).

### Compliance
`PageHeader` (title "Compliance"). `PillTabs` per framework (CIS AWS, SOC 2, …). A posture gauge `Surface` card (large `RollupNumber` percentage + `text-positive`/`text-warning` tone) beside framework `Surface` cards (name, controls passed "n/m" `font-mono`, `StatusBadge`). Main body: `VerifiedChecklist` of controls (pass/fail/warn/unknown with counts) and a remediation `GuidedFlow` (readOnly) showing the guided fix journey.

### Tickets (access requests)
List: `PageHeader` (title "Tickets", action primary "New request"). `DataTable` of requests: ID (`font-mono`), Requester, Tools (`Badge` row), Status (`StatusBadge` with custom labels: Pending / Peeyush review / Kamal review / Approved / Done), Created. Detail: two-column — left `Surface` facts card + resources list; right `Timeline` (variant "status") of the approval chain. New request: a 4-step `GuidedFlow` (Details → Tools & access → Review → Submitted) with `TextInput` fields and tool multi-select as selectable `Surface level={2}` tiles.

### Knowledge base
`PageHeader` (eyebrow "AI", title "Knowledge base"). Status `StatTile` row (Documents, Chunks, Last ingest). The **ask panel**: a `Surface level={1}` card with a large `TextInput` (search icon, placeholder "Ask about your estate…"), answer area in body text with citation chips (`Badge` variant "info-soft" — the one saturated accent), and source list rows (`AppIconTile` kind "repo"/"storage" + doc title + `font-mono` source path).

### Settings (admin)
`PageHeader` (title "Settings", eyebrow "Admin"). Stacked `Surface level={1}` cards: Scan frequency (radio-style `Surface level={2}` option rows + `Button` primary sm "Save"), Platform admins (`DataTable`: Email `font-mono`, Role `Badge`, Note; row action "Remove" tertiary sm; footer `TextInput` + "Add admin"), Integration health (`ProviderChip` + `StatusBadge` + last sync `font-mono`).

### Marketing landing (public)
Hero on pure `bg-canvas`: display-type headline (Space Grotesk, `text-ink`), subline `text-mute`, single white primary CTA + secondary text button. Below: live estate stats strip (`RollupNumber` counters with `text-iris` glyphs), capability grid of `Surface level={1}` cards (`AppIconTile` + title + two lines `text-mute`), and a provider connect strip (`ProviderChip` row). Generous vertical rhythm (~py-24 sections), max-w-6xl centered.

## Content vocabulary

Accounts: `arcane-prod · 404063516552`, `cwt-mgmt`. Regions: `ap-south-1`, `us-east-1`. Resources: `truesight-prod-cluster`, `sg-0f3a91c2`, `vpc-prod-east`, `arn:aws:iam::…:role/truesight-readonly`. Repos: `iac-truesight-platform`, `arcane-securities-frontend-next`. Money in USD with cents. Timestamps `font-mono` (`14:32`, `2m ago`). Severities/drift use the exact enums (`critical…info`, `in_sync`, `drifted`, `missing_in_cloud`, `unmanaged`).
