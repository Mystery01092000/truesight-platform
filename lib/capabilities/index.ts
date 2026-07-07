/**
 * Capability filter — a presentation/persona layer ("curate what this session
 * shows"), NOT a security control. Switching a capability off hides its nav
 * entry and widgets for this browser session only; server-side role gates are
 * untouched. The estate/inventory core (overview counts, aws/azure/topology)
 * is never gated — only these five capability keys are.
 */
export const CAPABILITIES = ["cost", "security", "compliance", "developers", "tickets"] as const;

export type CapabilityKey = (typeof CAPABILITIES)[number];

export type CapabilityMeta = {
  label: string;
  description: string;
  routes: string[];
};

export const CAPABILITY_META: Record<CapabilityKey, CapabilityMeta> = {
  cost: {
    label: "Cost",
    description: "Cloud spend, monthly totals and cost breakdowns.",
    routes: ["/cost"],
  },
  security: {
    label: "Security",
    description: "Vulnerabilities, findings and severity counters.",
    routes: ["/security"],
  },
  compliance: {
    label: "Compliance",
    description: "Drift findings and compliance posture.",
    routes: ["/compliance"],
  },
  developers: {
    label: "Developers",
    description: "GitHub contributors, repositories and code activity.",
    routes: ["/github", "/developers"],
  },
  tickets: {
    label: "Tickets",
    description: "Request queues and ticket status.",
    routes: ["/tickets"],
  },
};

export const CAPABILITY_STORAGE_KEY = "truesight.capabilities.v1";

/** The capability that owns a route, or null for the never-gated estate core. */
export function capabilityForRoute(href: string): CapabilityKey | null {
  for (const key of CAPABILITIES) {
    const { routes } = CAPABILITY_META[key];
    if (routes.some((r) => href === r || href.startsWith(`${r}/`))) return key;
  }
  return null;
}
