import { NextResponse } from "next/server";
import { eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { resources, integrationAccounts, driftFindings } from "@/db/schema";
import { cacheable } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated landing statistics.
 *
 * Powers the marketing hero's "· Live" estate preview with COARSE governance
 * totals only — no per-resource detail, no names/URNs, no secrets. Every value
 * is a cheap indexed COUNT/aggregate over the materialized `resources` table,
 * memoized behind a short TTL so anonymous traffic can't turn this into a load
 * source. If the estate is empty the numbers are honest zeros, never invented.
 */

/** Cache key + TTL, shared with the sync route so a sync can bust it eagerly. */
export const LANDING_STATS_CACHE_KEY = "landing:stats:v1";
const CACHE_TTL_SECONDS = 30;

export type LandingStats = {
  /** Resources currently present across every connected cloud. */
  resources: number;
  /** Connected AWS accounts + Azure subscriptions (GitHub org excluded). */
  accounts: number;
  /** Terraform drift findings that are not `in_sync` (real drift only). */
  drift: number;
  /** Present-ratio coverage: present / ever-seen, as a whole percentage 0–100. */
  coverage: number;
  /** Present-resource counts per provider. */
  providers: { aws: number; azure: number; github: number };
  /** When this snapshot was computed (ISO-8601). */
  updatedAt: string;
};

async function computeStats(): Promise<LandingStats> {
  const [providerRows, [totals], [accountsRow], [driftRow]] = await Promise.all([
    // Present-resource counts, grouped by provider (one scan, one row per provider).
    db
      .select({ provider: resources.provider, n: sql<number>`count(*)::int` })
      .from(resources)
      .where(eq(resources.present, true))
      .groupBy(resources.provider),
    // Ever-seen total (present + absent) — the coverage denominator.
    db.select({ total: sql<number>`count(*)::int` }).from(resources),
    // Cloud accounts + subscriptions only (GitHub org is not an "account · sub").
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(integrationAccounts)
      .where(inArray(integrationAccounts.provider, ["aws", "azure"])),
    // Real drift: exclude in-sync findings so the tile means "needs attention".
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(driftFindings)
      .where(ne(driftFindings.classification, "in_sync")),
  ]);

  const providers = { aws: 0, azure: 0, github: 0 };
  let present = 0;
  for (const row of providerRows) {
    present += row.n;
    if (row.provider === "aws") providers.aws = row.n;
    else if (row.provider === "azure") providers.azure = row.n;
    else if (row.provider === "github") providers.github = row.n;
  }

  const total = totals?.total ?? 0;
  const coverage = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    resources: present,
    accounts: accountsRow?.n ?? 0,
    drift: driftRow?.n ?? 0,
    coverage,
    providers,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    // The cache is a non-essential optimization: never let it (or the env read it
    // performs) take down the stats. If it faults, log and compute directly.
    let stats: LandingStats;
    try {
      stats = await cacheable(LANDING_STATS_CACHE_KEY, CACHE_TTL_SECONDS, computeStats);
    } catch (cacheErr) {
      console.error("[landing-stats] cache layer failed, computing directly:", cacheErr);
      stats = await computeStats();
    }
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  } catch (err) {
    // Log server-side (private CloudWatch) so a data/runtime fault is diagnosable —
    // a silently-swallowed catch here would hide exactly this kind of outage. Never
    // leak internals or fabricate numbers to the client: it renders a graceful,
    // non-misleading fallback (no fake stats, no "· Live") on this 503.
    console.error("[landing-stats] failed to compute estate stats:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
