import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resources } from "@/db/schema";
import type { ResourceKind } from "@/lib/taxonomy";
import {
  toKind,
  type AccountGroupData,
  type EstateResource,
  type ServiceGroupData,
} from "@/components/estate/types";

/**
 * AWS estate data access. Reads the materialized `resources` table (real
 * discovered AWS resources — never mocked), normalizes rows into serializable
 * {@link EstateResource} view-models, and buckets them account → service for
 * the explorer UI.
 */

/** Fetch present AWS resources, optionally scoped to a single account. */
export async function getAwsResources(account?: string): Promise<EstateResource[]> {
  const where = account
    ? and(
        eq(resources.provider, "aws"),
        eq(resources.present, true),
        eq(resources.account, account),
      )
    : and(eq(resources.provider, "aws"), eq(resources.present, true));

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
    })
    .from(resources)
    .where(where)
    .orderBy(asc(resources.service), asc(resources.name));

  return rows.map((r) => ({
    urn: r.urn,
    name: r.name?.trim() || r.urn,
    account: r.account ?? "unknown",
    region: r.region ?? "global",
    service: r.service?.trim() || "Other",
    kind: toKind(r.type),
    status: r.status ?? "unknown",
    lastSeen: r.lastSeen ? new Date(r.lastSeen).toISOString() : null,
  }));
}

/** Most frequent kind in a set (drives the group glyph); ties resolve to first seen. */
function dominantKind(items: EstateResource[]): ResourceKind {
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

/** Rank so unhealthy resources surface first inside a group. */
const STATUS_RANK: Record<EstateResource["status"], number> = {
  stopped: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

/** Bucket a flat resource list into per-service groups, sorted by size. */
export function groupByService(items: EstateResource[]): ServiceGroupData[] {
  const byService = new Map<string, EstateResource[]>();
  for (const it of items) {
    const list = byService.get(it.service);
    if (list) list.push(it);
    else byService.set(it.service, [it]);
  }

  const groups: ServiceGroupData[] = [];
  for (const [service, list] of byService) {
    const sorted = [...list].sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
    );
    groups.push({
      account: sorted[0]?.account ?? "unknown",
      service,
      kind: dominantKind(sorted),
      regions: [...new Set(sorted.map((r) => r.region))].sort(),
      count: sorted.length,
      resources: sorted,
    });
  }

  return groups.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
}

/** Bucket a flat resource list into per-account groups (each with service groups). */
export function groupByAccount(items: EstateResource[]): AccountGroupData[] {
  const byAccount = new Map<string, EstateResource[]>();
  for (const it of items) {
    const list = byAccount.get(it.account);
    if (list) list.push(it);
    else byAccount.set(it.account, [it]);
  }

  const groups: AccountGroupData[] = [];
  for (const [account, list] of byAccount) {
    const services = groupByService(list);
    groups.push({
      account,
      resourceCount: list.length,
      serviceCount: services.length,
      services,
    });
  }

  return groups.sort((a, b) => b.resourceCount - a.resourceCount || a.account.localeCompare(b.account));
}
