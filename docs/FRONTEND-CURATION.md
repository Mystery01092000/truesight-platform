# Argus — Frontend Premium-Experience Curation Blueprint

> Read-only audit + implementable curation plan for the shipped Next.js 16 / React 19 /
> Tailwind v4 / React Flow / motion-v12 surface. Source of truth for the premium evolution.
> References are exact (`file:line`). Nothing here has been applied — this is the plan.
>
> Design north stars (from `AGENTS.md` / `DESIGN.md`): **Raycast** near-black chrome +
> surface-ladder elevation + scarce white CTA + `ss03` Inter; **hazel.ai** visual-first
> auto-cycling motion; **New Relic** cinematic topology; **Digio** guided governance;
> **Emil-Kowalski** motion restraint.

---

## 0. System inventory (what exists today)

| Layer | Files | State |
|---|---|---|
| Tokens | `app/globals.css:8-91` (`@theme`) | 4-step surface ladder, 4 accents (+soft), 5 radii, 3 `--animate-*` + `topo-flow` keyframe |
| Taxonomy | `lib/taxonomy/index.ts` | enums + `RESOURCE_KIND_ACCENT` (143), `RESOURCE_KIND_ICON` (168), `EDGE_KINDS` (114) |
| UI primitives | `components/ui/*` | `Surface`, `Button`, `Badge`+`StatusBadge`, `PillTabs`, `Reveal`, `Keycap`, `AppIconTile`, `TextInput`, `DataTable` |
| Nav | `components/nav/*`, `lib/nav.ts` | `Sidebar`, `TopBar`, `AppChrome`, `Footer`; **only 3 nav items** |
| Estate | `components/estate/*` | `ResourceCard`, `ServiceGroup`, `EstateFilters`, `AccountResourceExplorer` |
| Topology | `components/topology/*`, `lib/topology/*` | `TopologyCanvas`, `ResourceNode`, `GroupNode`, `FlowEdge`, `DetailPanel`, `Legend`, `ScopeTabs`, `focus.ts`; ELK layered engine |
| Command | `components/command/CommandPalette.tsx` | ⌘K "Ask Argus" |
| Routes | `app/(marketing)`, `app/(auth)/login`, `app/(app)/{overview,aws,aws/[account],topology}` | shipped |

Shipped nav (`lib/nav.ts:10`): **Overview · AWS estate · Topology** only.

---

## 1. Semantic color-marking system

### 1.1 Token reality (`app/globals.css:37-44`)

Only four saturated accents exist, each with a 15%-alpha "soft" fill:

| Token | Hex | Soft (15%) |
|---|---|---|
| `--color-accent-blue` | `#57c1ff` | `rgba(87,193,255,.15)` |
| `--color-accent-green` | `#59d499` | `rgba(89,212,153,.15)` |
| `--color-accent-red` | `#ff6161` | `rgba(255,97,97,.15)` |
| `--color-accent-yellow` | `#ffc533` | `rgba(255,197,51,.15)` |

Chrome greys: `ink #f4f4f6`, `body #cdcdcd`, `mute #9c9c9d`, `ash #6a6b6c`, `stone #434345`;
surfaces `canvas #07080a → surface #0d0d0d → elevated #101111 → card #121212`.

### 1.2 Authoritative meaning → token map (single source of truth)

| Domain | Value | Token / class | Where it is ALLOWED to appear |
|---|---|---|---|
| **Resource status** | healthy | `bg-accent-green` | left status rail (3px), DetailPanel dot |
| | degraded | `bg-accent-yellow` | ″ |
| | stopped | `bg-accent-red` | ″ |
| | unknown | `bg-stone` (`#434345`) | ″ |
| **Resource kind** (glyph identity) | compute/container/network/cdn/queue | `accent-blue` | glyph tile bg-soft + icon **only** |
| | database/storage/registry | `accent-green` | ″ |
| | iam/secret | `accent-red` | ″ |
| | serverless/ai/monitoring | `accent-yellow` | ″ |
| | repo/team/member/unknown | `mute` | ″ |
| **Terraform drift** | in_sync | `accent-green` | drift ring / drift badge |
| | drifted | `accent-yellow` | drift ring / badge |
| | missing_in_cloud | `accent-red` | drift ring / badge |
| | unmanaged | `accent-blue` (outline) | drift badge |
| | unknown | `mute` | badge |
| **Severity** | critical / high | `accent-red` | StatusBadge, security counters |
| | medium | `accent-yellow` | ″ |
| | low / info | `accent-blue` | ″ |
| **Provider** (proposed, §1.5) | AWS | `#FF9900` | provider chip glyph only |
| | Azure | `#0078D4` | ″ |
| | GitHub | `#c9d1d9` (neutral) | ″ |
| | Terraform | `#7B42BC` | ″ |

### 1.3 The discipline (codify verbatim in `DESIGN.md`)

- **Chrome is monochrome.** Surfaces, borders, buttons, nav, tables, text = grey ladder only.
  `Button` (`components/ui/Button.tsx`) and `Badge` base already enforce this — keep it.
- **Accent is confined to three carriers:** (a) **glyph tiles** (`AppIconTile`,
  `ResourceNode` kind glyph), (b) **status rails / dots**, (c) **drift rings / StatusBadges**.
  Never on a border, heading, divider, or body text of chrome.
- **Location disambiguates hue.** Green/yellow/red each carry two meanings (kind family +
  health/severity). This is only legible because *kind* lives in the **square glyph tile**
  and *health* lives in the **3px left rail** — never swap those carriers.
- **One white CTA pill per fold** (`--color-primary #ffffff`); already scarce.

### 1.4 Inconsistencies found (with fixes)

1. **[CRITICAL] Drift enum divergence.** `components/ui/Badge.tsx:33` declares a *local*
   `DriftStatus = "in-sync" | "drifted" | "pending" | "unknown"` — hyphenated, invents
   `pending`, and **cannot express** the canonical `missing_in_cloud` / `unmanaged`
   (`lib/taxonomy/index.ts:59-65`, underscore form). Two enums for one concept.
   **Fix:** import `DriftStatus` from `lib/taxonomy`; extend `STATUS_TONE` with
   `in_sync→green, drifted→yellow, missing_in_cloud→red, unmanaged→blue, unknown→mute`;
   delete the local type.

2. **[CRITICAL] Health rendered in drift vocabulary.** `components/estate/types.ts`
   `statusBadge()` maps `healthy→"in-sync"`, `degraded→"pending"`, `stopped→"drifted"`.
   A *stopped* resource shows a red badge that reads as **"drifted"** even when Terraform
   is in sync — a semantic lie once real drift lands. **Fix:** give `StatusBadge` a
   first-class `health` domain (`healthy→green, degraded→yellow, stopped→red, unknown→mute`)
   and stop borrowing drift tones for health.

3. **[HIGH] Type-unsound accent map.** `RESOURCE_KIND_ACCENT: Record<ResourceKind, AccentToken>`
   (`lib/taxonomy/index.ts:143`) assigns `'mute'` to repo/team/member/unknown, but
   `AccentToken` (128-135) is only the 4 accents. Components silently re-widen with
   `as Accent` (`ResourceNode.tsx:18`, `AppIconTile.tsx:14`). **Fix:** export
   `type GlyphAccent = AccentToken | 'mute'` and type the map/consumers with it.

4. **[HIGH] Drift is computed but never drawn.** `TopoNodeData.drift` exists
   (`lib/topology/types.ts:40`) and `TopoStats.drifted` is counted, yet `ResourceNode`
   renders **no drift ring** — only the health rail + selection ring. `graph.ts:123`
   hardcodes `drift:"unknown"` and the promised `DriftOverlay.tsx` (T-3.9) does not exist.
   The signature "drift with no blind spots" story is invisible on the hero canvas.
   **Fix:** see §3.4.

5. **[MED] Severity `low` == `info` == blue.** Distinguish: keep `info→blue`, move
   `low→mute` (or a desaturated blue) so triage scanning separates "advisory" from "trivial".

### 1.5 Contrast / WCAG AA

- Accent-on-soft pairs sit on ~`#12` effective bg: blue `#57c1ff` ≈ 7:1 (AAA), green ≈ 8:1,
  yellow ≈ 11:1, red `#ff6161` ≈ 5.2:1 (AA pass ≥ small). All acceptable.
- **[FAIL] `text-ash #6a6b6c` on `bg-surface-card #121212`** ≈ **3.0:1** — used for the node
  meta line at **10.5px** (`ResourceNode.tsx` labels block) and card sublabels. Below AA
  (needs 4.5:1 for <18px). **Fix:** promote meta text to `text-mute #9c9c9d` (≈ 5.6:1) or
  raise size to 12px+ and weight 450.
- `text-stone #434345` dot separators are decorative (`aria-hidden`) — acceptable.
- Focus ring is monochrome `hairline-strong` (`globals.css:127`) — correct, never colored.

---

## 2. Design interactions / micro-interactions

### 2.1 Existing motion vocabulary (keep, standardize)

| Motion | Params | Source |
|---|---|---|
| Signature reveal spring | `spring, stiffness 120, damping 18` | `Reveal.tsx:12`, `PillTabs.tsx:53` |
| Node entrance | `spring 220/24`, opacity `.45s`, per-node `appearDelay` | `ResourceNode.tsx:62` |
| DetailPanel slide | `spring 320/32` | `DetailPanel.tsx:60` |
| Canvas scan sweep | translate `-25%→125%`, `1.05s`, `cubic-bezier(.4,0,.2,1)` | `TopologyCanvas.tsx:188` |
| Edge data-flow | `topo-flow .9s linear infinite`, dash `5 7` | `globals.css:148` |
| Edge draw-in | opacity `.7s ease` on `.topo-revealed` | `globals.css:139` |
| Aperture pupil | `--animate-pulse-ring 2s` | `Logo.tsx:58`, `globals.css:67` |

Reduced-motion floor is solid (`globals.css:115` + per-component `useReducedMotion`). Keep.

### 2.2 Per-component curation (durations/easings to add)

- **Buttons** (`Button.tsx`): add press feedback `active:scale-[0.98]` + `transition
  transform 120ms cubic-bezier(.4,0,.2,1)`; hover = ladder step-up already implied — make it
  explicit `transition-colors 150ms`. No accent, no shadow.
- **PillTabs** (`PillTabs.tsx:53`): the `layoutId` sliding indicator (spring 120/18) is the
  premium moment — extend the same pattern to `ScopeTabs` and the capability showcase tabs.
- **Reveal**: default `y=12`, `once=true` is right; for grids pass `delay={i*0.06}`
  (overview already does, `overview/page.tsx:58`). Standardize stagger step at **60ms**.
- **Number roll-ups** (missing): overview stat values (`overview/page.tsx:61`, 40px
  `tabular-nums`) render statically. Add a count-up (`spring 120/18`, ~700ms, reduced-motion →
  final value) — this is the single highest-visibility "flat" spot. Drift/vuln/cost counters
  should share one `<RollupNumber>` primitive.
- **ResourceCard** (`ResourceCard.tsx:28`): hover only does `bg-surface-elevated`. Add a 1px
  **left-rail brighten** on hover and `group-hover:text-ink` (already on name) — good; extend
  to a subtle `translate-x-[1px]` reveal of a chevron affordance for drill-down.
- **Command palette** (`CommandPalette.tsx`): overlay appears with no transition. Add
  `AnimatePresence`: backdrop fade `.15s`, panel `spring 320/32` + `y: -8→0`; selected-row
  `data-[selected]` already themed. This is the "primary navigation metaphor" — it must feel
  physical (Raycast parity).
- **Focus-by-contrast** (topology): `focus.ts` dims non-neighbors to `opacity .28`
  (`ResourceNode.tsx`) and edges to `.09` (`FlowEdge.tsx`) — excellent; replicate this
  "spotlight" idiom in the estate explorer when a service group is expanded.

### 2.3 "AI-slop default" flags

- Static stat numbers (no roll-up) — §2.2.
- Command palette hard cut-in — §2.2.
- Uniform `Reveal` on every block risks a "everything fades up" cadence — reserve `Reveal`
  for first-fold + section entrances; use instant for dense list items (they already stagger
  via topology, keep estate lists instant).
- Empty states are visually fine but copy is generic (§5).

---

## 3. Topology mind-map curation (the signature surface)

### 3.1 Current engine

- `lib/topology/graph.ts` renders **only the connected weave** (nodes touching an edge;
  isolated inventory stays in the estate explorer) via edge-closure seeding — good instinct.
- `lib/topology/layout.ts`: ELK `layered`, `direction RIGHT`, per-account subgraphs,
  `nodeNodeBetweenLayers 128`, `spacing.nodeNode 18`, `NETWORK_SIMPLEX`, `aspectRatio 1.7`.
- Nodes `NODE_W 216 × NODE_H 66` (`types.ts:91`); one `GroupNode` box per account.
- Edges (`FlowEdge.tsx:13`): `contains`=stone hairline (structural), `uses`/`routes-to`=blue
  flowing, `depends-on`=mute dashed, `deployed-from`=green dashed.

### 3.2 The hairball problem

`getTopology` emits **every** connected node with no summarization. A single VPC
`contains` dozens of subnets + SGs; layered ELK then packs them into one tall low-signal
band, burying the ECS→ECR→workload weave that is the actual story. This reads as a diagram,
not a premium mind-map.

### 3.3 Curation spec — cluster low-signal fan-out

**Algorithm (server-side, `lib/topology/graph.ts` + `cluster.ts`):**
1. After building `nodes/edges`, for each node compute out-degree of `contains` edges grouped
   by child `kind`.
2. **Collapse rule:** when a parent has **≥ N (default 6)** `contains`-children of the *same
   kind* (e.g. `network` subnets, `iam`/SG), replace them with **one `ClusterNode`**
   `{ parentUrn, kind, count, childUrns[] }`. Re-point their external edges to the cluster
   (dedupe). Keep individually-connected children (a subnet a workload actually `uses`)
   promoted out of the cluster so the weave stays intact.
3. Layout the reduced graph → far fewer layers, workload spine dominant.
4. Emit `clusters[]` in `TopoGraph` for the legend counts.

**New node types (`components/topology/nodes/`):**
- `ClusterNode` — stack/“deck” card (offset hairline layers behind), kind glyph, `×count`
  pill, chevron. Click → **expand in place** (spring 220/24 stagger 40ms) or open a
  side-drawer list. Collapsed by default.
- Keep `ResourceNode` as the atom; make `GroupNode` (account) a quiet labeled frame.

**Node-card anatomy (refine `ResourceNode`):** `[3px health rail][36px kind glyph tile,
bg-soft + icon][name 12.5px/500 ink][service·region 11px mute]` + **new: top-right drift
dot** (§3.4). Selection = `accent-blue/70 border + ring` (exists). Hover = one ladder notch
(exists).

**Edge semantics (elevate the hero weave):** make `deployed-from` (ECR image → ECS service)
and `uses` the visual heroes — thicker (1.6), blue flow, and **always animated** even at
rest; demote `contains` to near-invisible stone (already 1px) and route it *into* clusters so
it stops crowding. Add arrowheads only on `depends-on`/`deployed-from` (directional lineage).

### 3.4 Drift ring (implement the missing signature)

Add to `ResourceNode`: a corner ring/halo keyed to `data.drift` —
`in_sync→none`, `drifted→ring-2 ring-accent-yellow/60`, `missing_in_cloud→ring-2
ring-accent-red/70 + dashed`, `unmanaged→ring-1 ring-accent-blue/50 dashed`. Populate
`graph.ts:123` from `drift_findings` (currently hardcoded `"unknown"`). Entrance: drift rings
pulse once (`pulse-ring` token) after the weave settles. Legend gains a drift row.

### 3.5 Layout: layered vs organic

Keep **layered RIGHT** as the default — it makes the ECR→ECS→ALB→workload lineage read
left-to-right like a story (New Relic cinematic). Offer an **organic (ELK `stress`/force)**
toggle in `ScopeTabs` for a "constellation" mind-map read of a single account. Layered is the
hero; organic is the explore mode. Do **not** default to force (it re-creates the hairball).

### 3.6 Entrance choreography (wire to real SSE, T-3.9)

Groups fade+scale (spring 120/18) → resources stagger 40ms/account (`appearDelay` exists) →
edges `pathLength 0→1` via `.topo-revealed` (exists) → drift rings pulse. Drive `revealed`
off `/api/topology/stream` progress, not a fixed timer. Reduced-motion → instant (floor
exists).

---

## 4. Capability showcase (Discover · Visualize · Detect drift · Optimize cost · Secure)

**Status:** a working auto-cycling showcase already lives on the landing page
(`app/(marketing)/page.tsx` ~250-330): `AnimatePresence mode="wait"`, per-cap `visual`,
`.35s` crossfade + `scale .96`, reduced-motion aware. This is the hazel-style pattern — good.

**Curation:**
- **Copy = verb-led, ≤ 6 words per cap.** e.g. Discover → *"Every account, mapped read-only."*
  Visualize → *"See the whole weave."* Detect drift → *"Catch what Terraform forgot."*
  Optimize cost → *"Find idle spend."* Secure → *"Surface findings by severity."*
- **Tab indicator:** reuse `PillTabs` `layoutId` slider (spring 120/18) so manual selection
  feels physical; auto-advance every ~4.5s, pause on hover/focus, keyboard arrow support.
- **Visuals must be real-data-representative** (per acceptance): Discover=account tiles
  materializing; Visualize=mini topology weave draw-in; Detect drift=yellow-ring node + diff
  rows; Optimize cost=number roll-up + sparkline; Secure=severity counters. Each visual reuses
  the *same* production primitives (glyph tiles, rails, rollups) so landing == app.
- **Second home:** embed a compact single-row variant as an **Overview band**
  (`app/(app)/overview`) beneath the stat grid — turns the empty overview into a guided
  "what Argus does" surface for first-run admins (Digio guided-governance).
- **Anatomy:** `Surface level={1} radius="lg"` container · left: tab list + active copy ·
  right: `min-h-40` visual stage. Already the structure — just enrich visuals + copy.

---

## 5. Per-screen polish notes

**Landing** (`app/(marketing)/page.tsx`): hero h1 44/56px 600 (`:338`) is right; stripe band
correctly hero-only (DESIGN whitespace rule). Sections 96px apart — verify rhythm holds below
showcase. Aperture (`:27`) is the brand tell — ensure it honors reduced-motion (pulse-ring is
CSS, covered by floor).

**Login** (`app/(auth)/login/page.tsx` → `LoginForm`): minimal (20-line page). Add the
Aperture mark + one-line value prop above the form so the gate feels like Argus, not a bare
form; monochrome, single white CTA; focus ring = hairline-strong (no colored ring —
`TextInput.tsx:6`).

**Overview** (`overview/page.tsx`): stat grid 40px `tabular-nums` — add roll-ups (§2.2);
`Integrations` hint hardcodes "AWS · Azure · GitHub" (`:38`) while only AWS ships — make it
reflect live providers. Add the showcase band (§4). Empty voice: replace terse copy with
guided next-step ("Trigger a sync →").

**AWS estate** (`aws/page.tsx`): empty state is well-built (`Cloud` glyph + prose). Filters
via `EstateFilters`/`PillTabs`. Keep tiles-first, tables drill-down (DESIGN intent).

**AWS account** (`aws/[account]/page.tsx`, 92 lines): ensure `ServiceGroup` headers carry a
count + collapse, and `ResourceCard` meta uses `text-mute` not `text-ash` (§1.5 fix).

**Topology**: see §3. Legend must document *all three* color domains (kind vs health vs
drift) or the hue-doubling confuses. Add a "layered / organic" toggle and cluster counts.

**Global voice:** empty/loading/error copy should speak in the Argus persona ("Argus is
watching N accounts…", "Argus hasn't mapped this estate yet.") — one `EmptyState` primitive,
reused, monochrome glyph + prose + one CTA.

---

## 6. Upcoming-screen IA & labelling

Nav is currently gated to shipped, real-data pillars (`lib/nav.ts`) — keep that rule; add
each below as it lands. Proposed `NAV_ITEMS` order + routes:

| Label | Route | Icon | Notes |
|---|---|---|---|
| Overview | `/overview` | `LayoutDashboard` | + showcase band |
| AWS estate | `/aws` | `Cloud` | shipped |
| **Azure estate** | `/azure`, `/azure/[subscription]` | `Cloud` (Azure-tinted chip) | full parity |
| Topology | `/topology` | `Workflow` | shipped |
| **Terraform** | `/terraform` | `Boxes` | module/state/drift |
| **Pipelines** | `/pipelines` | `GitBranch`/`Workflow` | Jenkins |
| Cost | `/cost` | `Wallet` | later phase |
| Security | `/security` | `ShieldCheck` | later phase |

**Azure parity (Phase 4):** `/azure` mirrors `/aws` exactly — account/sub → region/RG →
service → resource, same `EstateFilters`, same `ResourceCard`. Reuse `lib/taxonomy/azure.ts`
so Azure native types map to the *same* `ResourceKind` accents (a Cosmos DB glyph is
`accent-green` like RDS). Only the **provider chip** differs (Azure `#0078D4`, §1.5). Sub-nav
tabs: *Subscriptions · Resource groups · Services*.

**Jenkins / Pipelines (`/pipelines`):** IA = *Pipelines → Stages → Runs*. Cards use
`PipelineStageKind` (`lib/taxonomy/index.ts:100`). Journey: pipeline list → run timeline
(stage chips: checkout/build/test/deploy) → stage detail (logs/artifacts). Link
`deployed-from` edges back into topology (image lineage). Labels: *Pipelines*, *Runs*,
*Stages*, *Artifacts*.

**Terraform (`/terraform`):** IA = *Modules · State · Drift*. Tabs:
- *Modules* — module tree (source, inputs/outputs) as cards or a mini React Flow map.
- *State* — resources under management, addressed by `urn`.
- *Drift* — the drift dashboard: `StatusBadge` per canonical `DriftStatus`
  (in_sync/drifted/missing_in_cloud/unmanaged) + a "reconcile" journey (Digio guided).
  Drift here shares the *exact* ring colors used on the topology canvas (§3.4) so the
  vocabulary is one language across surfaces.

Showcase vocabulary maps 1:1: Discover→estate (AWS/Azure), Visualize→Topology, Detect
drift→Terraform, Optimize cost→Cost, Secure→Security.

---

## 7. Prioritized backlog

### P0 — semantic integrity + signature payoff (do first)
- **P0-1** Unify drift enum: delete local `DriftStatus` in `components/ui/Badge.tsx:33`,
  import canonical from `lib/taxonomy`, extend `STATUS_TONE` to cover
  `missing_in_cloud`/`unmanaged`. *(Badge.tsx)*
- **P0-2** Add a `health` domain to `StatusBadge` and stop `statusBadge()` borrowing drift
  tones for health. *(components/estate/types.ts, components/ui/Badge.tsx)*
- **P0-3** Export `GlyphAccent = AccentToken | 'mute'`; retype `RESOURCE_KIND_ACCENT` +
  consumers; drop `as Accent` casts. *(lib/taxonomy/index.ts, ResourceNode.tsx, AppIconTile.tsx)*
- **P0-4** Implement the **drift ring** on `ResourceNode` + populate real drift in
  `graph.ts:123` from `drift_findings`; add drift row to `Legend`. *(components/topology/nodes/ResourceNode.tsx, lib/topology/graph.ts, components/topology/Legend.tsx)*
- **P0-5** Fix AA contrast: replace `text-ash` on card/node meta with `text-mute` (or 12px+).
  *(ResourceNode.tsx labels block, ResourceCard.tsx sublabels)*
- **P0-6** `<RollupNumber>` count-up primitive; apply to overview stats. *(new components/ui/RollupNumber.tsx, app/(app)/overview/page.tsx)*
- **P0-7** Cluster low-signal `contains` fan-out into `ClusterNode` (≥6 same-kind children).
  *(lib/topology/graph.ts + cluster.ts, components/topology/nodes/ClusterNode.tsx)*
- **P0-8** Animate the command palette open (backdrop fade `.15s` + panel spring 320/32).
  *(components/command/CommandPalette.tsx)*

### P1 — premium feel
- **P1-1** Elevate hero weave: bold `uses`/`deployed-from` edges, arrowheads on directional
  edges, demote `contains`. *(components/topology/edges/FlowEdge.tsx)*
- **P1-2** Enrich showcase copy (verb-led, ≤6 words) + real-data visuals; slider indicator via
  `PillTabs` layoutId. *(app/(marketing)/page.tsx, components/marketing/CapabilityShowcase.tsx)*
- **P1-3** Embed compact showcase band on `/overview`. *(app/(app)/overview/page.tsx)*
- **P1-4** Button press `active:scale-[0.98]` + explicit transitions. *(components/ui/Button.tsx)*
- **P1-5** Login: add Aperture mark + value-prop line. *(components/auth/LoginForm.tsx)*
- **P1-6** Add provider tint tokens + `ProviderChip` (accent confined to chip). *(app/globals.css, new components/ui/ProviderChip.tsx)*
- **P1-7** Fix overview "AWS · Azure · GitHub" hint to reflect live providers. *(overview/page.tsx:38)*
- **P1-8** Single `EmptyState` primitive with Argus persona voice. *(new components/ui/EmptyState.tsx)*

### P2 — reach + parity scaffolding
- **P2-1** `/azure` estate parity (reuse estate components + taxonomy/azure). *(app/(app)/azure/*)*
- **P2-2** `/terraform` (Modules/State/Drift) with shared drift vocabulary. *(app/(app)/terraform/*)*
- **P2-3** `/pipelines` (Jenkins) pipeline→stage→run journeys. *(app/(app)/pipelines/*)*
- **P2-4** Organic (ELK stress) layout toggle in `ScopeTabs`. *(lib/topology/layout.ts, components/topology/ScopeTabs.tsx)*
- **P2-5** Steady-state pulse on live edges + severity `low→mute` separation. *(FlowEdge.tsx, Badge.tsx)*
- **P2-6** Standardize `Reveal` stagger at 60ms and reserve it for first-fold/section entrances. *(components/ui/Reveal.tsx usages)*

---

*Constraint honored: this document is the only file authored by the curation workstream; no
code files were modified. All references verified against the working tree.*
