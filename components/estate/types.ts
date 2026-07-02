import {
  RESOURCE_KINDS,
  type ResourceKind,
  type ResourceStatus,
} from "@/lib/taxonomy";

/**
 * Estate view-models — the plain, serializable shapes the AWS explorer passes
 * from RSC data-loaders into client components (PillTabs filtering,
 * @tanstack/react-table). Kept free of Drizzle row types so they cross the
 * server → client boundary cleanly.
 */

/** One AWS resource, normalized from the `resources` table for the UI. */
export type EstateResource = {
  urn: string;
  name: string;
  account: string;
  region: string;
  service: string;
  /** Canonical taxonomy kind (from `resources.type`). */
  kind: ResourceKind;
  status: ResourceStatus;
  /** ISO string of `lastSeen` (serializable across the RSC boundary). */
  lastSeen: string | null;
};

/** All resources of one AWS service within one account. */
export type ServiceGroupData = {
  account: string;
  service: string;
  /** Representative (most common) kind — drives the group glyph. */
  kind: ResourceKind;
  regions: string[];
  count: number;
  resources: EstateResource[];
};

/** Everything discovered in one AWS account, bucketed by service. */
export type AccountGroupData = {
  account: string;
  resourceCount: number;
  serviceCount: number;
  services: ServiceGroupData[];
};

const KIND_SET = new Set<string>(RESOURCE_KINDS);

/** Narrow an arbitrary `resources.type` string to a canonical kind. */
export function toKind(type: string | null | undefined): ResourceKind {
  return type && KIND_SET.has(type) ? (type as ResourceKind) : "unknown";
}

/**
 * Human label for a canonical kind (e.g. `cdn` → `CDN`, `serverless` →
 * `Serverless`). Acronyms stay upper-cased.
 */
const KIND_LABEL: Partial<Record<ResourceKind, string>> = {
  cdn: "CDN",
  iam: "IAM",
  ai: "AI",
};
export function kindLabel(kind: ResourceKind): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * The left status rail / dot color for a resource health status. Uses the
 * taxonomy accent tokens (the only saturated color, confined to status signal).
 */
export const STATUS_RAIL: Record<ResourceStatus, string> = {
  healthy: "bg-accent-green",
  degraded: "bg-accent-yellow",
  stopped: "bg-accent-red",
  unknown: "bg-stone",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format an ISO timestamp deterministically (UTC, TZ-independent) so it renders
 * identically on the server and client — no hydration mismatch. `Jun 3, 2026`.
 */
export function formatLastSeen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Map a resource health status onto the shared {@link StatusBadge} vocabulary.
 * StatusBadge now has a first-class health domain, so we pass the canonical
 * ResourceStatus directly — no more borrowing drift tones for health signal.
 */
export function statusBadge(status: ResourceStatus): {
  status: ResourceStatus;
  label: string;
} {
  switch (status) {
    case "healthy":
      return { status: "healthy", label: "Healthy" };
    case "degraded":
      return { status: "degraded", label: "Degraded" };
    case "stopped":
      return { status: "stopped", label: "Stopped" };
    default:
      return { status: "unknown", label: "Unknown" };
  }
}
