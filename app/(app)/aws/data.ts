import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { driftFindings, resources } from "@/db/schema";
import {
  sortEnvironments,
  toKind,
  type EstateGroupSummary,
  type EstateResource,
} from "@/components/estate/types";
import type { ResourceStatus } from "@/lib/taxonomy";

/**
 * AWS discovery-console data access. Extends the base estate query with the
 * discovery dimensions the console renders — environment tag, raw tags,
 * provider-native type (from `attributes.nativeType`) and per-account
 * Terraform drift rollups. Reads the materialized `resources` table (real
 * discovered AWS resources — never mocked).
 *
 * Lives beside the route (not in lib/estate/query.ts) so the estate screens
 * own their data shape without touching the shared query module.
 */

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Fetch present AWS resources (with env/tags/native type), optionally per account. */
export async function getAwsEstateResources(account?: string): Promise<EstateResource[]> {
  const where = account
    ? and(eq(resources.provider, "aws"), eq(resources.present, true), eq(resources.account, account))
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
      environment: resources.environment,
      tags: resources.tags,
      attributes: resources.attributes,
      lastSeen: resources.lastSeen,
    })
    .from(resources)
    .where(where)
    .orderBy(asc(resources.service), asc(resources.name));

  return rows.map((r) => {
    const attrs = (r.attributes ?? {}) as Record<string, unknown>;
    const service = r.service?.trim() || "Other";
    return {
      urn: r.urn,
      name: r.name?.trim() || r.urn,
      account: r.account ?? "unknown",
      region: r.region?.trim() || "global",
      service,
      kind: toKind(r.type),
      status: (r.status ?? "unknown") as ResourceStatus,
      lastSeen: r.lastSeen ? new Date(r.lastSeen).toISOString() : null,
      nativeType: str(attrs.nativeType) || service,
      environment: r.environment?.trim() || null,
      tags: r.tags ?? {},
    } satisfies EstateResource;
  });
}

/** URNs carrying at least one non-`in_sync` Terraform drift finding. */
export async function getDriftedUrns(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ urn: driftFindings.urn })
    .from(driftFindings)
    .where(ne(driftFindings.classification, "in_sync"));
  return new Set(rows.map((r) => r.urn));
}

/** Roll a flat resource list up into per-account summary cards. */
export function summarizeAccounts(
  items: EstateResource[],
  drifted: Set<string>,
): EstateGroupSummary[] {
  const byAccount = new Map<string, EstateResource[]>();
  for (const it of items) {
    const list = byAccount.get(it.account);
    if (list) list.push(it);
    else byAccount.set(it.account, [it]);
  }

  const summaries: EstateGroupSummary[] = [];
  for (const [account, list] of byAccount) {
    summaries.push({
      id: account,
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
