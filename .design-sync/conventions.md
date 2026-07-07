# Truesight design system — build conventions

Truesight is a **dark-only** cloud-governance design system (Raycast-inspired). There is no light theme and no theme provider — the look comes from Tailwind utility classes backed by tokens in `styles.css`.

## Root setup (required)

Every screen must sit on the canvas with body text defaults. Wrap your app root (or use `Surface level={0}`):

```jsx
<div className="min-h-screen bg-canvas text-body font-sans">…</div>
```

Without `bg-canvas`, the white `primary` button, `text-on-dark` labels, and hairline borders are invisible. Fonts (Inter, Space Grotesk, JetBrains Mono) ship with the system — headings `h1–h4` get Space Grotesk automatically; use `font-mono` for ALL machine data (ids, ARNs, counts, money, timestamps).

## Styling idiom — Tailwind utilities from this token vocabulary only

**Elevation is the 4-step surface ladder, never drop shadows.** Prefer the `Surface` component (`level` 0–3); raw classes: `bg-canvas` → `bg-surface` → `bg-surface-elevated` → `bg-surface-card`. Levels 1–3 pair with a 1px hairline: `border border-hairline` (also `border-hairline-soft`, `border-hairline-emphasis`, `border-hairline-strong`).

| Purpose | Classes |
|---|---|
| Text tones | `text-ink` (titles) · `text-body` (default) · `text-mute` (secondary) · `text-ash` (faint) · `text-on-dark`, `text-on-dark-mute` (chrome) |
| The ONE white CTA | `bg-primary text-on-primary` — or just `<Button variant="primary">`; every other action is monochrome |
| Status semantics | `text-positive`/`bg-positive-soft` · `text-critical`/`bg-critical-soft` · `text-warning`/`bg-warning-soft` · info blue via `Badge variant="info-soft"` |
| Brand accent | `text-iris` / `bg-iris-soft` (#7c8dff, "the watching eye") — glyphs and illustration only, never body text or buttons |
| Type scale | `text-display`, `text-title`, `text-label` (13px labels), `text-micro` (11px), `font-display`, `font-mono` |
| Radii | `rounded-xs` (badges) · `rounded-md` (buttons/inputs) · `rounded-lg` (cards) · `rounded-xl` (hero surfaces) |

Never use default Tailwind palette colors (`bg-gray-800`, `text-white`, `shadow-*`) — always the token classes above. Saturated color appears ONLY through status semantics and glyph tiles.

## Where the truth lives

- `styles.css` → imports `_ds_bundle.css`: every token as CSS custom properties (`--color-*`, `--text-*`) plus all compiled utilities. Read it before inventing a class.
- `guidelines/DESIGN.md`: the full design spec (surface ladder, type pairing, accent discipline).
- `components/general/<Name>/<Name>.d.ts` + `<Name>.prompt.md`: exact props per component (23 components: Surface, Button, Badge, StatusBadge, StatTile, DataTable, Drawer, EmptyState, FilterBar, GuidedFlow, Keycap, PageHeader, Pagination, PillTabs, ProviderChip, Reveal, RollupNumber, Skeleton, Sparkline, TextInput, Timeline, VerifiedChecklist, AppIconTile).

## Idiomatic composition

```jsx
<div className="min-h-screen bg-canvas text-body font-sans p-8">
  <PageHeader eyebrow="FinOps" title="Cost console"
    description="Cross-cloud spend, updated hourly."
    actions={<Button variant="primary" size="sm">Run cost sync</Button>} />
  <div className="mt-6 grid grid-cols-3 gap-4">
    <StatTile label="Monthly spend" value={4821.37} decimals={2} prefix="$"
      delta={6.2} deltaInverted deltaSuffix="%"
      sparkline={<Sparkline data={[142,155,149,161,172,168,164]} width={200} height={32} />} />
    <StatTile label="Resources" value={1284} delta={42} />
    <Surface level={3} className="p-4">
      <span className="text-label text-mute">Last sync</span>
      <div className="mt-1 font-mono text-[13px] text-ink">14:32 · in_sync</div>
    </Surface>
  </div>
</div>
```

Domain vocabulary for realistic content: providers are `aws | azure | github | terraform` (`ProviderChip`), severities `critical|high|medium|low|info`, drift states `in_sync|drifted|missing_in_cloud|unmanaged` (`StatusBadge` maps all of these directly).
