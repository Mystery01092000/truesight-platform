import "server-only";

import { and, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { costSnapshots } from "@/db/schema";
import type { CloudProvider } from "@/lib/taxonomy";

export type CostRangeKey = "7d" | "30d" | "90d" | "mtd";

const RANGE_DAYS: Record<"7d" | "30d" | "90d", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Resolve a range key to an inclusive-start / exclusive-end UTC YYYY-MM-DD window. */
export function resolveCostRange(range: CostRangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (range === "mtd") {
    const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { startDate: start, endDate: end };
  }
  const start = new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

export interface CostSeriesPoint {
  date: string;
  aws: number;
  azure: number;
}

export interface CostServiceRow {
  service: string;
  provider: CloudProvider;
  amount: number;
  sparkline: number[];
}

export interface CostOverview {
  total: number;
  aws: number;
  azure: number;
  dailyAvg: number;
  currency: string;
  series: CostSeriesPoint[];
  byService: CostServiceRow[];
  hasData: boolean;
}

/**
 * Read the materialized cost view for a window directly from `cost_snapshots`.
 * Aggregates are computed in SQL (SUM + GROUP BY) so the RSC payload stays small; each
 * service breakdown carries its own daily sparkline. Honest zeros when no rows exist.
 */
export async function getCostOverview(range: CostRangeKey): Promise<CostOverview> {
  const { startDate, endDate } = resolveCostRange(range);
  const start = new Date(startDate);
  const end = new Date(`${endDate}T23:59:59Z`);
  const where = and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end));

  // Daily series per provider.
  const seriesRows = await db
    .select({
      date: sql<string>`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      provider: costSnapshots.provider,
      amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
    })
    .from(costSnapshots)
    .where(where)
    .groupBy(
      sql`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      costSnapshots.provider,
    )
    .orderBy(sql`1`);

  const seriesMap = new Map<string, CostSeriesPoint>();
  for (const row of seriesRows) {
    let pt = seriesMap.get(row.date);
    if (!pt) {
      pt = { date: row.date, aws: 0, azure: 0 };
      seriesMap.set(row.date, pt);
    }
    if (row.provider === "aws") pt.aws += row.amount;
    else if (row.provider === "azure") pt.azure += row.amount;
  }
  const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Provider totals.
  const totalRows = await db
    .select({
      provider: costSnapshots.provider,
      amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
    })
    .from(costSnapshots)
    .where(where)
    .groupBy(costSnapshots.provider);

  let aws = 0;
  let azure = 0;
  for (const row of totalRows) {
    if (row.provider === "aws") aws += row.amount;
    else if (row.provider === "azure") azure += row.amount;
  }
  const total = aws + azure;
  const dayCount = Math.max(1, series.length);
  const hasData = totalRows.length > 0 && total > 0;

  // Per-service breakdown + sparklines.
  const breakdown = await db
    .select({
      service: sql<string>`coalesce(${costSnapshots.service}, 'Other')`,
      provider: costSnapshots.provider,
      amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
    })
    .from(costSnapshots)
    .where(where)
    .groupBy(sql`coalesce(${costSnapshots.service}, 'Other')`, costSnapshots.provider)
    .orderBy(sql`coalesce(sum(${costSnapshots.amount}::numeric), 0) DESC`);

  const sparkRows = breakdown.length
    ? await db
        .select({
          service: sql<string>`coalesce(${costSnapshots.service}, 'Other')`,
          provider: costSnapshots.provider,
          date: sql<string>`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
        })
        .from(costSnapshots)
        .where(where)
        .groupBy(
          sql`coalesce(${costSnapshots.service}, 'Other')`,
          costSnapshots.provider,
          sql`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        )
        .orderBy(sql`3`)
    : [];

  const sparkMap = new Map<string, number[]>();
  for (const row of sparkRows) {
    const k = `${row.service}|${row.provider}`;
    let arr = sparkMap.get(k);
    if (!arr) {
      arr = [];
      sparkMap.set(k, arr);
    }
    arr.push(row.amount);
  }

  const byService: CostServiceRow[] = breakdown.map((b) => ({
    service: b.service,
    provider: (b.provider as CloudProvider) ?? "aws",
    amount: b.amount,
    sparkline: sparkMap.get(`${b.service}|${b.provider}`) ?? [],
  }));

  return {
    total,
    aws,
    azure,
    dailyAvg: total / dayCount,
    currency: "USD",
    series,
    byService,
    hasData,
  };
}
