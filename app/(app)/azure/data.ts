import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resources, integrationAccounts, integrationSync } from "@/db/schema";
import { toKind } from "@/components/estate/types";
import type { ResourceKind, ResourceStatus } from "@/lib/taxonomy";

/**
 * Azure estate data access. Reads the materialized `resources` table (real
 * discovered Azure resources — never mocked), normalizes rows into serializable
 * view-models, and buckets them resource-group → service for the explorer UI.
 *
 * Azure's natural top-level dimension inside a subscription is the resource
 * group (the parity of an AWS account), so the estate is grouped by
 * `resourceGroup` and drills down at `/azure/[rg]`.
 */

/** One Azure resource, normalized from the `resources` table for the UI. */
export type AzureResource = {
  urn: string;
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  region: string;
  service: string;
  /** Provider-native ARM type, e.g. `Microsoft.Network/virtualNetworks`. */
  nativeType: string;
  kind: ResourceKind;
  status: ResourceStatus;
  lastSeen: string | null;
};

/** All resources of one Azure service within one resource group. */
export type AzureServiceGroup = {
  resourceGroup: string;
  service: string;
  kind: ResourceKind;
  regions: string[];
  count: number;
  resources: AzureResource[];
};

/** Everything discovered in one resource group, bucketed by service. */
export type AzureRgGroup = {
  resourceGroup: string;
  resourceCount: number;
  serviceCount: number;
  services: AzureServiceGroup[];
};

export type AzureAccount = {
  subscriptionId: string | null;
  displayName: string | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
};

const NO_RG = "(no resource group)";
/** Synthetic container nodes surfaced only as the grouping dimension, not tiles. */
const CONTAINER_SERVICE = "Resources/resourceGroups";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Fetch present Azure resources, optionally scoped to one resource group. */
export async function getAzureResources(resourceGroup?: string): Promise<AzureResource[]> {
  const rows = await db
    .select({
      urn: resources.urn,
      name: resources.name,
      account: resources.account,
      region: resources.region,
      service: resources.service,
      type: resources.type,
      status: resources.status,
      lastSeen: resources.lastSeen,
      attributes: resources.attributes,
    })
    .from(resources)
    .where(and(eq(resources.provider, "azure"), eq(resources.present, true)))
    .orderBy(asc(resources.service), asc(resources.name));

  const mapped = rows
    .map((r) => {
      const attrs = (r.attributes ?? {}) as Record<string, unknown>;
      const service = r.service?.trim() || "Other";
      return {
        urn: r.urn,
        name: r.name?.trim() || r.urn,
        subscriptionId: r.account ?? "unknown",
        resourceGroup: str(attrs.resourceGroup) || NO_RG,
        region: r.region?.trim() || "global",
        service,
        nativeType: str(attrs.nativeType) || service,
        kind: toKind(r.type),
        status: (r.status ?? "unknown") as ResourceStatus,
        lastSeen: r.lastSeen ? new Date(r.lastSeen).toISOString() : null,
      } satisfies AzureResource;
    })
    // The resource-group container nodes are the grouping dimension itself.
    .filter((r) => r.service !== CONTAINER_SERVICE);

  return resourceGroup ? mapped.filter((r) => r.resourceGroup === resourceGroup) : mapped;
}

/** Resolve the connected Azure subscription + its latest sync for the hero. */
export async function getAzureAccount(): Promise<AzureAccount> {
  const [acct] = await db
    .select({
      id: integrationAccounts.id,
      externalId: integrationAccounts.externalId,
      displayName: integrationAccounts.displayName,
    })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.provider, "azure"))
    .limit(1);

  if (!acct) return { subscriptionId: null, displayName: null, lastSyncAt: null, syncStatus: null };

  const [sync] = await db
    .select({ startedAt: integrationSync.startedAt, status: integrationSync.status })
    .from(integrationSync)
    .where(eq(integrationSync.accountId, acct.id))
    .orderBy(desc(integrationSync.startedAt))
    .limit(1);

  return {
    subscriptionId: acct.externalId,
    displayName: acct.displayName,
    lastSyncAt: sync?.startedAt ? new Date(sync.startedAt).toISOString() : null,
    syncStatus: sync?.status ?? null,
  };
}

/** Rank so unhealthy resources surface first inside a group. */
const STATUS_RANK: Record<ResourceStatus, number> = {
  stopped: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

function dominantKind(items: AzureResource[]): ResourceKind {
  const tally = new Map<ResourceKind, number>();
  for (const it of items) tally.set(it.kind, (tally.get(it.kind) ?? 0) + 1);
  let best: ResourceKind = "unknown";
  let bestN = -1;
  for (const [kind, n] of tally) {
    if (n > bestN) {
      best = kind;
      bestN = n;
    }
  }
  return best;
}

/** Bucket a flat resource list into per-service groups, sorted by size. */
export function groupByService(items: AzureResource[]): AzureServiceGroup[] {
  const byService = new Map<string, AzureResource[]>();
  for (const it of items) {
    const list = byService.get(it.service);
    if (list) list.push(it);
    else byService.set(it.service, [it]);
  }

  const groups: AzureServiceGroup[] = [];
  for (const [service, list] of byService) {
    const sorted = [...list].sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
    );
    groups.push({
      resourceGroup: sorted[0]?.resourceGroup ?? NO_RG,
      service,
      kind: dominantKind(sorted),
      regions: [...new Set(sorted.map((r) => r.region))].sort(),
      count: sorted.length,
      resources: sorted,
    });
  }

  return groups.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
}

/** Bucket a flat resource list into per-resource-group groups (each with service groups). */
export function groupByResourceGroup(items: AzureResource[]): AzureRgGroup[] {
  const byRg = new Map<string, AzureResource[]>();
  for (const it of items) {
    const list = byRg.get(it.resourceGroup);
    if (list) list.push(it);
    else byRg.set(it.resourceGroup, [it]);
  }

  const groups: AzureRgGroup[] = [];
  for (const [resourceGroup, list] of byRg) {
    const services = groupByService(list);
    groups.push({
      resourceGroup,
      resourceCount: list.length,
      serviceCount: services.length,
      services,
    });
  }

  return groups.sort(
    (a, b) => b.resourceCount - a.resourceCount || a.resourceGroup.localeCompare(b.resourceGroup),
  );
}
