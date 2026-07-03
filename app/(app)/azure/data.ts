import "server-only";

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { driftFindings, resources, integrationAccounts, integrationSync } from "@/db/schema";
import { COST_SOURCES } from "@/lib/integrations/cost-sources";
import {
  sortEnvironments,
  toKind,
  type EstateGroupSummary,
} from "@/components/estate/types";
import type { ResourceKind, ResourceStatus } from "@/lib/taxonomy";

/**
 * Azure estate data access. Reads the materialized `resources` table (real
 * discovered Azure resources — never mocked), normalizes rows into serializable
 * view-models, and rolls them up per resource group for the discovery console.
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
  /** Environment tag (prod / staging / dev …) when discovered, else null. */
  environment: string | null;
  /** Raw ARM tags (key → value). */
  tags: Record<string, string>;
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
      environment: resources.environment,
      tags: resources.tags,
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
        environment: r.environment?.trim() || null,
        tags: r.tags ?? {},
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
    .where(
      and(
        eq(integrationAccounts.provider, "azure"),
        // Never resolve the cost-source registry row as "the subscription".
        ne(integrationAccounts.externalId, COST_SOURCES.azure.externalId),
      ),
    )
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

/** URNs carrying at least one non-`in_sync` Terraform drift finding. */
export async function getDriftedUrns(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ urn: driftFindings.urn })
    .from(driftFindings)
    .where(ne(driftFindings.classification, "in_sync"));
  return new Set(rows.map((r) => r.urn));
}

/** Roll a flat resource list up into per-resource-group summary cards. */
export function summarizeResourceGroups(
  items: AzureResource[],
  drifted: Set<string>,
): EstateGroupSummary[] {
  const byRg = new Map<string, AzureResource[]>();
  for (const it of items) {
    const list = byRg.get(it.resourceGroup);
    if (list) list.push(it);
    else byRg.set(it.resourceGroup, [it]);
  }

  const summaries: EstateGroupSummary[] = [];
  for (const [rg, list] of byRg) {
    summaries.push({
      id: rg,
      resourceCount: list.length,
      serviceCount: new Set(list.map((r) => r.service)).size,
      regionCount: new Set(list.map((r) => r.region)).size,
      driftCount: list.filter((r) => drifted.has(r.urn)).length,
      environments: sortEnvironments(
        list.map((r) => r.environment).filter((e): e is string => Boolean(e)),
      ),
      degraded: list.filter((r) => r.status === "degraded").length,
      stopped: list.filter((r) => r.status === "stopped").length,
    });
  }

  return summaries.sort(
    (a, b) => b.resourceCount - a.resourceCount || a.id.localeCompare(b.id),
  );
}
