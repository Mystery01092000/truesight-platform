# Frontend Architecture Assessment — Next.js vs Vue Microfrontends

**Verdict: Truesight stays on Next.js (App Router, RSC). Vue microfrontends are not adopted.** This is a definitive position, not a deferral. The reasoning below is specific to this platform, not a framework beauty contest.

## What the Vue case would be

A fair statement of the strongest argument for Vue here:

1. **Smaller runtime, faster hydration.** Vue 3 + Vite ships a leaner client baseline than React, and its template compiler produces tightly-scoped reactive updates — attractive for widget-dense dashboards.
2. **Microfrontend seams.** Module federation with independently deployed Vue remotes would let Topology, Ticketing, and the Developer Portal ship on independent cadences with isolated failure domains.
3. **Simpler mental model** for contributors who find RSC/server-action boundaries confusing.

## Why it loses for Truesight

1. **Truesight's performance problem was never the view library.** Measured causes of the reported lag: a 0.25-vCPU ECS task, `force-dynamic` on every route, per-request server-side ELK layout, an always-on WebGL shader, and unpaginated tables. All are fixed within the current stack (caching, right-sizing, CDN, virtualization). Swapping React for Vue would have fixed none of them.
2. **RSC is load-bearing here.** Nearly every screen is an async Server Component reading Postgres directly (`lib/*/query.ts`) with thin client islands. That architecture is why API surface area stays small and secrets never reach the client. Vue has no equivalent of RSC + Server Actions at this maturity; a migration means rebuilding the data layer as client-fetched APIs — strictly more code, more latency, more attack surface.
3. **Microfrontends solve an org problem Truesight doesn't have.** Module federation pays off when multiple teams need independent deploy trains. Truesight is one team, one repo, one Jenkins pipeline, one deploy. The costs (shared-dependency version skew, duplicated design tokens across remotes, two build systems, federation runtime failures) buy nothing here. Next.js route groups + `next/dynamic` code-splitting already give per-screen bundle isolation — each route only ships its own islands.
4. **Ecosystem lock-in that matters**: `@xyflow/react` (Topology), TanStack Table/Query/Virtual, `motion/react`, `cmdk` — the platform's hardest UI is built on React-native libraries. Vue Flow exists but trails React Flow in features and community; the rewrite risk lands exactly on the screen the platform is judged by.
5. **Bundle discipline, not bundle religion.** The real bundle-size lever in this codebase is keeping AWS/Azure SDKs server-side (`serverExternalPackages`, already configured) and auditing client islands — worth doing continuously; changing frameworks is orthogonal.

## What we adopt instead (the practical microfrontend wins, without federation)

- **Route-level code splitting** (default in App Router) + `next/dynamic` for heavy islands (React Flow canvas, charts) so no screen pays for another screen's JS.
- **Shared token layer** (`app/globals.css` `@theme`) as the single design contract — the actual thing microfrontends usually fracture.
- **Per-screen ownership boundaries** in the repo (components/<domain>, lib/<domain>) so teams can parallelize without deploy-train coupling.
- **Caching + CDN** (Redis data cache, CloudFront for `/_next/static`) — the latency wins microfrontend advocates usually chase.

Revisit only if: a second product team needs an independent release cadence inside the same shell, or React Flow becomes a strategic liability. Neither is on the horizon.
