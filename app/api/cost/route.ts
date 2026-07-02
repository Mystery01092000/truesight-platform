import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { costSnapshots } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { cacheable } from "@/lib/cache";
import { runCostSync } from "@/lib/integrations/sync/cost-sync";
import type { CloudProvider } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeKey = "7d" | "30d" | "90d" | "mtd";
type GroupKey = "service" | "tag" | "account";

const RANGE_DAYS: Record<Exclude<RangeKey, "mtd">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Resolve a range key to an inclusive-start / exclusive-end YYYY-MM-DD window (UTC). */
function resolveRange(range: RangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (range === "mtd") {
    const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { startDate: start, endDate: end };
  }
  const days = RANGE_DAYS[range];
  const start = new Date(now.getTime() - days * 86_400_000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

interface SeriesPoint {
  date: string;
  aws: number;
  azure: number;
}

interface ServiceBreakdown {
  service: string;
  amount: number;
  provider: CloudProvider;
  sparkline: number[];
}

interface CostResponse {
  ok: true;
  data: {
    series: SeriesPoint[];
    totals: { aws: number; azure: number; all: number; currency: string; dailyAvg: number };
    byService: ServiceBreakdown[];
    byProvider: { provider: CloudProvider; amount: number }[];
    range: string;
    groupBy: string;
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
}

/**
 * Authenticated cost read. Reads materialized `cost_snapshots` (populated by a cost
 * sync), grouped + summed on the server so the client receives only the aggregates it
 * needs to render. Zero rows → honest zeros, never fabricated numbers.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role, "cost:read")) return forbidden();

  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get("range") ?? "30d") as RangeKey;
  const groupBy = (url.searchParams.get("groupBy") ?? "service") as GroupKey;

  // Cached per (range, groupBy) so a warm read skips every aggregate query.
  const data = await cacheable(
    `cost:summary:${rangeParam}:${groupBy}`,
    300,
    async (): Promise<CostResponse["data"]> => {
      const { startDate, endDate } = resolveRange(rangeParam);

      const start = new Date(startDate);
      const end = new Date(`${endDate}T23:59:59Z`);

      // Daily series per provider — SUM(amount) grouped by periodStart, pivoted into the
      // { date, aws, azure } shape the Sparkline/area chart wants.
      const seriesRows = await db
        .select({
          date: sql<string>`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          provider: costSnapshots.provider,
          amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
        })
        .from(costSnapshots)
        .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)))
        .groupBy(
          sql`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          costSnapshots.provider,
        )
        .orderBy(sql`1`);

      const seriesMap = new Map<string, SeriesPoint>();
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

      // Totals per provider across the window.
      const totalRows = await db
        .select({
          provider: costSnapshots.provider,
          amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
        })
        .from(costSnapshots)
        .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)))
        .groupBy(costSnapshots.provider);

      let awsTotal = 0;
      let azureTotal = 0;
      for (const row of totalRows) {
        if (row.provider === "aws") awsTotal += row.amount;
        else if (row.provider === "azure") azureTotal += row.amount;
      }
      const allTotal = awsTotal + azureTotal;
      const dayCount = Math.max(1, series.length);

      // Breakdown by the requested dimension. `tag` uses tagProduct, `service` uses service,
      // `account` uses account. Each row carries its provider + a sparkline of its daily sum.
      const dimension =
        groupBy === "tag"
          ? costSnapshots.tagProduct
          : groupBy === "account"
            ? costSnapshots.account
            : costSnapshots.service;

      const breakdown = await db
        .select({
          key: sql<string>`coalesce(${dimension}, 'Other')`,
          provider: costSnapshots.provider,
          amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
        })
        .from(costSnapshots)
        .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)))
        .groupBy(sql`coalesce(${dimension}, 'Other')`, costSnapshots.provider)
        .orderBy(sql`coalesce(sum(${costSnapshots.amount}::numeric), 0) DESC`);

      // Sparklines per (key+provider): daily amounts within the window, in date order.
      const sparkKeys = new Set(breakdown.map((b) => `${b.key}|${b.provider}`));
      const sparkRows = sparkKeys.size
        ? await db
            .select({
              key: sql<string>`coalesce(${dimension}, 'Other')`,
              provider: costSnapshots.provider,
              date: sql<string>`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
              amount: sql<number>`coalesce(sum(${costSnapshots.amount}::numeric), 0)::float`,
            })
            .from(costSnapshots)
            .where(and(gte(costSnapshots.periodStart, start), lte(costSnapshots.periodStart, end)))
            .groupBy(
              sql`coalesce(${dimension}, 'Other')`,
              costSnapshots.provider,
              sql`to_char(${costSnapshots.periodStart} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
            )
            .orderBy(sql`3`)
        : [];

      const sparkMap = new Map<string, { date: string; amount: number }[]>();
      for (const row of sparkRows) {
        const k = `${row.key}|${row.provider}`;
        let arr = sparkMap.get(k);
        if (!arr) {
          arr = [];
          sparkMap.set(k, arr);
        }
        arr.push({ date: row.date, amount: row.amount });
      }

      const byService: ServiceBreakdown[] = breakdown.map((b) => ({
        service: b.key,
        amount: b.amount,
        provider: (b.provider as CloudProvider) ?? "aws",
        sparkline: (sparkMap.get(`${b.key}|${b.provider}`) ?? []).map((p) => p.amount),
      }));

      const byProvider = totalRows.map((r) => ({
        provider: (r.provider as CloudProvider) ?? "aws",
        amount: r.amount,
      }));

      return {
        series,
        totals: {
          aws: awsTotal,
          azure: azureTotal,
          all: allTotal,
          currency: "USD",
          dailyAvg: allTotal / dayCount,
        },
        byService,
        byProvider,
        range: rangeParam,
        groupBy,
      };
    },
  );

  const body: CostResponse = { ok: true, data };
  return NextResponse.json(body);
}

/**
 * Admin-gated cost sync trigger. Pulls fresh AWS Cost Explorer + Azure Cost Management
 * data and replaces the current window in `cost_snapshots`, then revalidates the cost
 * surface so the dashboard reflects the new data on next load.
 */
export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role, "sync:trigger")) return forbidden();

  const summary = await runCostSync();

  revalidatePath("/cost", "page");

  return NextResponse.json({ ok: true, summary });
}
