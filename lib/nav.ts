import { LayoutDashboard, Cloud, Workflow } from "lucide-react";

/**
 * Primary app navigation — one entry per pillar. Icons are lucide components.
 * IMPORTANT: only list pillars whose screen renders real data. Nav is gated to
 * shipped capabilities so there are never dead links or "coming soon" stubs —
 * add each pillar here as it comes online (Azure, Topology, GitHub, Cost,
 * Security, Compliance follow in their phases).
 */
export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/aws", label: "AWS estate", icon: Cloud },
  { href: "/topology", label: "Topology", icon: Workflow },
] as const;

/** Command-palette destinations ("Ask Argus" quick-nav). */
export const COMMAND_ROUTES = NAV_ITEMS.map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
