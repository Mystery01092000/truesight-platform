import "server-only";

import { and, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { costRollups, costSnapshots } from "@/db/schema";
import type { CloudProvider } from "@/lib/taxonomy";

export type CostRangeKey = "7d" | "30d" | "90d" | "mtd";
export type CostGroupKey = "service" | "account" | "provider" | "day";

const RANGE_DAYS: Record<"7d" | "30d" | "90d", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Hard cap on line items shipped to the client table (top spend first). */
const LINE_ITEM_CAP = 1000;

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

/** One key of a breakdown dimension with its per-provider split. */
export interface CostBreakdownSlice {
  key: string;
  aws: number;
  azure: number;
  total: number;
}

/** One row of the line-item drill-down table (provider/account/service/day grain). */
export interface CostLineItem {
  id: string;
  day: string;
  provider: CloudProvider;
  account: string;
  service: string;
  amount: number;
}

export interface CostFacetOption {
  value: string;
  count: number;
}

export interface CostFacets {
  provider: CostFacetOption[];
  account: CostFacetOption[];
  service: CostFacetOption[];
}

export interface CostConsoleData {
  range: CostRangeKey;
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  currency: string;
  hasData: boolean;
  /** Which table served this read: precomputed rollups or raw snapshot aggregates. */
  source: "rollups" | "snapshots";
  total: number;
  aws: number;
  azure: number;
  dailyAvg: number;
  prevTotal: number;
  /** % change vs. the previous same-length window; null when there is no prior spend. */
  deltaPct: number | null;
  topService: { service: string; provider: CloudProvider; amount: number } | null;
  series: CostSeriesPoint[];
  breakdowns: Record<CostGroupKey, CostBreakdownSlice[]>;
  lineItems: CostLineItem[];
  /** True row count at this grain before the LINE_ITEM_CAP was applied. */
  lineItemsTotal: number;
  facets: CostFacets;
}

interface NormalizedRow {
  day: string;
  provider: CloudProvider;
  account: string;
  service: string;
  amount: number;
}

/**
 * Read the window from `cost_rollups` — the precomputed aggregate written at sync end,
 * already at (provider, account, service, day) grain.
 */
async function fetchRollupRows(start: Date, end: Date): Promise<NormalizedRow[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${costRollups.day} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      provider: costRollups.provider,
      account: sql<string>`coalesce(${costRollups.account}, 'unattributed')`,
      service: sql<string>`coalesce(${costRollups.service}, 'Other')`,
      amount: sql<number>`coalesce(sum(${costRollups.amount}::numeric), 0)::float`,
    })
    .from(costRollups)
    .where(and(gte(costRollups.day, start), lte(costRollups.day, end)))
    .groupBy(
      sql`to_char(${costRollups.day} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      costRollups.provider,
      sql`coalesce(${costRollups.account}, 'unattributed')`,
      sql`coalesce(${costRollups.service}, 'Other')`,
    );
  return rows.map((r) => ({ ...r, provider: (r.provider as CloudProvider) ?? "aws" }));
}

/** Fallback: aggregate raw `cost_snapshots` to the same grain when no rollups exist. */
async function fetchSnapshotRows(start: Date, end: Date): Promise<NormalizedRow[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      provider: costSnapshots.provider,
      account: sql<string>`coalesce(${costSnapshots.account}, 'unattributed')`,
      service: sql<string>`coalesce(${costSnapshots.service}, 'Other')`,
      amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
    })
    .from(costSnapshots)
    .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)))
    .groupBy(
      sql`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      costSnapshots.provider,
      sql`coalesce(${costSnapshots.account}, 'unattributed')`,
      sql`coalesce(${costSnapshots.service}, 'Other')`,
    );
  return rows.map((r) => ({ ...r, provider: (r.provider as CloudProvider) ?? "aws" }));
}

/** SUM(amount) over an arbitrary window against the chosen source table. */
async function sumWindow(
  source: "rollups" | "snapshots",
  start: Date,
  end: Date,
): Promise<number> {
  if (source === "rollups") {
    const [row] = await db
      .select({ amount: sql<number>`coalesce(sum(${costRollups.amount}::numeric), 0)::float` })
      .from(costRollups)
      .where(and(gte(costRollups.day, start), lte(costRollups.day, end)));
    return row?.amount ?? 0;
  }
  const [row] = await db
    .select({ amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float` })
    .from(costSnapshots)
    .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)));
  return row?.amount ?? 0;
}

function accumulate(map: Map<string, { aws: number; azure: number }>, key: string, row: NormalizedRow) {
  let entry = map.get(key);
  if (!entry) {
    entry = { aws: 0, azure: 0 };
    map.set(key, entry);
  }
  if (row.provider === "azure") entry.azure += row.amount;
  else entry.aws += row.amount;
}

function toSlices(map: Map<string, { aws: number; azure: number }>): CostBreakdownSlice[] {
  return [...map.entries()].map(([key, v]) => ({
    key,
    aws: v.aws,
    azure: v.azure,
    total: v.aws + v.azure,
  }));
}

function facetCounts(items: CostLineItem[], pick: (i: CostLineItem) => string, cap: number): CostFacetOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const v = pick(item);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, cap);
}

/**
 * FinOps console read. Prefers the precomputed `cost_rollups` aggregate (sub-100ms path);
 * falls back to grouping raw `cost_snapshots` when the window has no rollups. One pass
 * over the normalized (provider, account, service, day) rows yields every widget's data —
 * stat row, all four breakdowns, facets and the capped line-item table. Honest zeros and
 * a null delta when there is nothing to compare against; nothing is ever fabricated.
 */
export async function getCostConsole(range: CostRangeKey): Promise<CostConsoleData> {
  const { startDate, endDate } = resolveCostRange(range);
  const start = new Date(startDate);
  const end = new Date(`${endDate}T23:59:59Z`);

  let source: "rollups" | "snapshots" = "rollups";
  let rows = await fetchRollupRows(start, end);
  if (rows.length === 0) {
    source = "snapshots";
    rows = await fetchSnapshotRows(start, end);
  }

  // Previous same-length window, ending the day before the current one starts.
  const startMs = start.getTime();
  const endDayMs = Date.parse(`${endDate}T00:00:00Z`);
  const lenDays = Math.max(1, Math.round((endDayMs - startMs) / 86_400_000) + 1);
  const prevStart = new Date(startMs - lenDays * 86_400_000);
  const prevEnd = new Date(startMs - 1000);
  const prevStartDate = prevStart.toISOString().slice(0, 10);
  const prevEndDate = prevEnd.toISOString().slice(0, 10);
  const prevTotal = rows.length > 0 ? await sumWindow(source, prevStart, prevEnd) : 0;

  // Single-pass aggregation for every dimension.
  const byDay = new Map<string, { aws: number; azure: number }>();
  const byService = new Map<string, { aws: number; azure: number }>();
  const byAccount = new Map<string, { aws: number; azure: number }>();
  let aws = 0;
  let azure = 0;
  for (const row of rows) {
    if (row.provider === "azure") azure += row.amount;
    else aws += row.amount;
    accumulate(byDay, row.day, row);
    accumulate(byService, row.service, row);
    accumulate(byAccount, row.account, row);
  }
  const total = aws + azure;
  const hasData = rows.length > 0 && total > 0;

  const series: CostSeriesPoint[] = toSlices(byDay)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((s) => ({ date: s.key, aws: s.aws, azure: s.azure }));

  const serviceSlices = toSlices(byService).sort((a, b) => b.total - a.total);
  const accountSlices = toSlices(byAccount).sort((a, b) => b.total - a.total);
  const daySlices = toSlices(byDay).sort((a, b) => a.key.localeCompare(b.key));
  const providerSlices: CostBreakdownSlice[] = [
    { key: "AWS", aws, azure: 0, total: aws },
    { key: "Azure", aws: 0, azure, total: azure },
  ].sort((a, b) => b.total - a.total);

  const top = serviceSlices[0];
  const topService = top
    ? {
        service: top.key,
        provider: (top.azure > top.aws ? "azure" : "aws") as CloudProvider,
        amount: top.total,
      }
    : null;

  // Line items — newest day first, largest spend first within a day, capped.
  const lineItemsAll: CostLineItem[] = rows
    .map((r) => ({
      id: `${r.provider}|${r.account}|${r.service}|${r.day}`,
      day: r.day,
      provider: r.provider,
      account: r.account,
      service: r.service,
      amount: r.amount,
    }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.amount - a.amount);
  const lineItems = lineItemsAll.slice(0, LINE_ITEM_CAP);

  // Facets are computed over the delivered rows so pill counts always match what
  // the client-side filter can actually narrow to.
  const facets: CostFacets = {
    provider: facetCounts(lineItems, (i) => i.provider, 4),
    account: facetCounts(lineItems, (i) => i.account, 8),
    service: facetCounts(lineItems, (i) => i.service, 10),
  };

  return {
    range,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    currency: "USD",
    hasData,
    source,
    total,
    aws,
    azure,
    dailyAvg: total / Math.max(1, series.length),
    prevTotal,
    deltaPct: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
    topService,
    series,
    breakdowns: {
      service: serviceSlices,
      account: accountSlices,
      provider: providerSlices,
      day: daySlices,
    },
    lineItems,
    lineItemsTotal: lineItemsAll.length,
    facets,
  };
}
