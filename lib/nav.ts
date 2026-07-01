import {
  LayoutDashboard,
  Cloud,
  Boxes,
  Workflow,
  GitBranch,
  DollarSign,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";

/** Primary app navigation — one entry per pillar. Icons are lucide components. */
export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/aws", label: "AWS estate", icon: Cloud },
  { href: "/azure", label: "Azure estate", icon: Boxes },
  { href: "/topology", label: "Topology", icon: Workflow },
  { href: "/github", label: "GitHub", icon: GitBranch },
  { href: "/cost", label: "Cost", icon: DollarSign },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/compliance", label: "Compliance", icon: ClipboardCheck },
] as const;

/** Command-palette destinations ("Ask Argus" quick-nav). */
export const COMMAND_ROUTES = NAV_ITEMS.map((i) => ({ href: i.href, label: i.label, icon: i.icon }));
