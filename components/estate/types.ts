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
  /** Provider-native type, e.g. `aws_ecs_service` | `Microsoft.Sql/servers`. */
  nativeType?: string;
  /** Environment tag (prod / staging / dev …) when discovered, else null. */
  environment?: string | null;
  /** Raw resource tags (key → value). */
  tags?: Record<string, string>;
};

/**
 * Per-account (AWS) or per-resource-group (Azure) rollup that powers the
 * discovery console summary cards. Plain and serializable — computed in the
 * server data loaders, rendered by EstateSummaryCard.
 */
export type EstateGroupSummary = {
  /** AWS account id or Azure resource-group name. */
  id: string;
  resourceCount: number;
  serviceCount: number;
  regionCount: number;
  /** Resources with a non-`in_sync` Terraform drift finding. */
  driftCount: number;
  /** Distinct environment tags seen in the group (prod first). */
  environments: string[];
  /** Unhealthy counts for the at-a-glance status line. */
  degraded: number;
  stopped: number;
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
 * Sort environments so the ones that matter most read first on chips
 * (prod → staging → dev → everything else alphabetically).
 */
const ENV_ORDER = ["prod", "production", "staging", "stage", "uat", "qa", "dev", "development"];
export function sortEnvironments(envs: Iterable<string>): string[] {
  return [...new Set(envs)].sort((a, b) => {
    const ia = ENV_ORDER.indexOf(a.toLowerCase());
    const ib = ENV_ORDER.indexOf(b.toLowerCase());
    return (ia === -1 ? ENV_ORDER.length : ia) - (ib === -1 ? ENV_ORDER.length : ib) ||
      a.localeCompare(b);
  });
}

/**
 * Azure `service` keys are the ARM type minus the `Microsoft.` prefix
 * (e.g. `Sql/servers/databases`, `Databricks/workspaces`). These helpers give
 * the legacy data estate sensible human labels and bucket it under one
 * "Data platform" section in the by-service view.
 */
const AZURE_SERVICE_LABEL: Record<string, string> = {
  "sql/servers": "SQL servers",
  "sql/servers/databases": "SQL databases",
  "sql/managedinstances": "SQL managed instances",
  "sql/managedinstances/databases": "SQL managed databases",
  "sql/virtualmachines": "SQL virtual machines",
  "databricks/workspaces": "Databricks workspaces",
  "datafactory/factories": "Data Factory",
  "datafactory/factories/pipelines": "Data Factory pipelines",
};

export function azureServiceLabel(service: string): string {
  return AZURE_SERVICE_LABEL[service.toLowerCase()] ?? service;
}

/** True when an Azure service key belongs to the legacy data estate. */
export function isDataPlatformService(service: string): boolean {
  const s = service.toLowerCase();
  return s.startsWith("sql") || s.startsWith("databricks") || s.startsWith("datafactory");
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
