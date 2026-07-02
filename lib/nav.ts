import { LayoutDashboard, Cloud, Cloudy, Workflow, Users, BookOpen, Wallet, ShieldAlert, ScrollText, Code2, Ticket, GitBranch, Settings } from "lucide-react";

/**
 * Primary app navigation — one entry per pillar. Icons are lucide components.
 * IMPORTANT: only list pillars whose screen renders real data. Nav is gated to
 * shipped capabilities so there are never dead links or "coming soon" stubs —
 * add each pillar here as it comes online (Azure, Topology, GitHub, Cost,
 * Security, Compliance follow in their phases).
 *
 * All pillar routes are pre-staged here so parallel feature subagents don't
 * need to edit this shared file. Each subagent creates its route; the nav
 * entry already points to it.
 */
export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/aws", label: "AWS estate", icon: Cloud },
  { href: "/azure", label: "Azure estate", icon: Cloudy },
  { href: "/topology", label: "Topology", icon: Workflow },
  { href: "/github", label: "GitHub", icon: Users },
  { href: "/cost", label: "Cost", icon: Wallet },
  { href: "/security", label: "Security", icon: ShieldAlert },
  { href: "/compliance", label: "Compliance", icon: ScrollText },
  { href: "/plans", label: "Plans", icon: GitBranch },
  { href: "/developers", label: "Developers", icon: Code2 },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/kb", label: "Knowledge Base", icon: BookOpen },
  // Nav has no role filtering — /settings self-gates server-side (admin-only).
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** Command-palette destinations ("Ask Argus" quick-nav). */
export const COMMAND_ROUTES = NAV_ITEMS.map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
