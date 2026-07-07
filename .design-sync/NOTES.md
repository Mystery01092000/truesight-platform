# design-sync notes — truesight-platform

- This is a Next.js APP repo, not a packaged library: no dist/, no shipped .d.ts. The DS is `components/ui/*.tsx` (22 components) + Tailwind v4 `@theme` tokens in `app/globals.css`.
- `entry: ./dist/index.js` is a deliberate placeholder that never exists — it anchors PKG_DIR at the repo root and soft-fails into the converter's synth-entry mode (barrel synthesized from `srcDir: components/ui`). Do not "fix" it by creating a dist.
- CSS must be compiled before the converter runs: `buildCmd` runs the Tailwind CLI over `app/globals.css` → `.design-sync/build-css/compiled.css` (cfg.cssEntry). Tailwind v4 auto-scans repo sources (including `.design-sync/previews/`), so re-run buildCmd after authoring previews that use new utility classes.
- Fonts: app uses next/font/google (Inter, Space Grotesk, JetBrains Mono) with `--font-*` CSS vars. Token font stacks fall back to literal family names, so previews work via local @font-face in `.design-sync/fonts/fonts.css` (latin subsets downloaded from Google Fonts, committed).

## Wave 1 learnings (folded 2026-07-05)

- **Capture freezes JS mount animations**: `package-capture.mjs` pins the page clock (`page.clock.setFixedTime`), so motion/react entrance animations stick at `opacity: 0`. The WORKING fix is the module-scope `matchMedia` shim forcing `prefers-reduced-motion` inside the affected previews (Reveal, GuidedFlow, Timeline, VerifiedChecklist) — components' `useReducedMotion()` reads the media query directly. The `MotionConfig reducedMotion="always"` provider chain (via `extraEntries` ds-extras.ts) was ALSO applied but proved insufficient on its own (MotionConfig does not disable opacity entrance animations and does not drive `useReducedMotion()`); it is kept because removing it would re-key every grade. Any NEW animate-on-mount component preview needs the shim.
- Synth-entry mode emits stub `.d.ts` (`[key: string]: unknown`); real contracts are hand-fed via `cfg.dtsPropsFor` (all 23 components, generated from source with `.ds-sync/gen-dts-props.mjs`, then hand-cleaned: React.-qualified types, inlined unions/shapes). Regenerate + re-clean if component APIs change.
- Component quirks: EmptyState self-wraps in Surface level 1; TextInput has no disabled: styles; AppIconTile `mute` accent is intentionally transparent; StatusBadge labels need `whitespace-nowrap` in tight table cells; DataTable footer only shows when rows > pageSize; drift enums use underscore form (`in_sync`, `missing_in_cloud`); Drawer needs cardMode single + viewport, DataTable cardMode column (both in cfg.overrides).
- Tailwind CSS must be recompiled (buildCmd) whenever previews add new utility classes — preview-rebuild does NOT re-copy CSS; agents cp compiled.css over ds-bundle/_ds_bundle.css mid-wave as a workaround.

## Re-sync risks

- `.design-sync/fonts/*.woff2` are downloaded snapshots of Google Fonts latin subsets — if the app's font families change (next/font config in app/layout.tsx), refresh them.
- `dtsPropsFor` is a hand-maintained snapshot of component APIs — it silently rots when components/ui props change; regenerate with `.ds-sync/gen-dts-props.mjs` (staged scripts dir, gitignored — regenerate it from NOTES history or re-derive) and re-clean.
- The Reveal/GuidedFlow preview matchMedia shims and the MotionConfig provider both assume components keep their `useReducedMotion()` guards.
- `entry: ./dist/index.js` must keep NOT existing (synth-entry anchor); a future real dist/ would change discovery behavior.
- Provider capitalization: `MotionConfig` must stay exported from ds-extras.ts via extraEntries or every preview fails PROVIDER_UNEXPORTED.
