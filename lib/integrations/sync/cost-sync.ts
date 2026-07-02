import "server-only";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import { costSnapshots } from "@/db/schema";

import { getAwsCosts, toCostSnapshots as awsToSnapshots } from "@/lib/integrations/aws/cost";
import {
  getAzureCosts,
  toCostSnapshots as azureToSnapshots,
} from "@/lib/integrations/azure/cost";

type Db = PostgresJsDatabase<typeof schema>;

export type CostSyncStatus = "ok" | "partial" | "error";

export interface CostProviderSummary {
  provider: "aws" | "azure";
  status: CostSyncStatus;
  rowCount: number;
  totalSpend: number;
  currency: string;
  error?: string;
}

export interface CostSyncSummary {
  status: CostSyncStatus;
  startedAt: string;
  finishedAt: string;
  range: { startDate: string; endDate: string };
  providers: CostProviderSummary[];
  totalRows: number;
}

/** Default look-back window: the last 30 days, refreshed each run. */
export function defaultCostRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86_400_000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/**
 * Run a cost sync: pull fresh AWS (Cost Explorer) + Azure (Cost Management) spend for
 * the given range, then REPLACE the matching `cost_snapshots` window so the table always
 * reflects the source of truth without accumulating stale duplicate rows. Both providers
 * are pulled in parallel; a single provider's failure is recorded as `partial`/`error`
 * rather than aborting the whole run.
 *
 * The `db` client is lazily imported so this module is safe to call from standalone
 * scripts (e.g. a scheduled Fargate task) that pass their own connection.
 */
export async function runCostSync(opts?: {
  db?: Db;
  startDate?: string;
  endDate?: string;
  granularity?: "DAILY" | "MONTHLY";
  tagKey?: string;
}): Promise<CostSyncSummary> {
  const db: Db = opts?.db ?? ((await import("@/db")).db as unknown as Db);
  const range = opts?.startDate && opts?.endDate
    ? { startDate: opts.startDate, endDate: opts.endDate }
    : defaultCostRange();
  const granularity = opts?.granularity ?? "DAILY";
  const startedAt = new Date();

  const ceOpts = { ...range, granularity };

  // Pull both providers concurrently; each adapter caches + degrades gracefully.
  const [awsRows, azureRows] = await Promise.all([
    getAwsCosts({ ...ceOpts, tagKey: opts?.tagKey }).catch((err) => {
      console.warn("[cost-sync] AWS cost pull failed:", (err as Error)?.message ?? err);
      return null;
    }),
    getAzureCosts(ceOpts).catch((err) => {
      console.warn("[cost-sync] Azure cost pull failed:", (err as Error)?.message ?? err);
      return null;
    }),
  ]);

  const providers: CostProviderSummary[] = [];

  const awsSnapshots = awsRows ? awsToSnapshots(awsRows) : [];
  const azureSnapshots = azureRows ? azureToSnapshots(azureRows) : [];

  providers.push(summarizeProvider("aws", awsRows, awsSnapshots.length));
  providers.push(summarizeProvider("azure", azureRows, azureSnapshots.length));

  // Persist: clear the same window first, then insert fresh rows. This keeps the table
  // authoritative — a Cost Explorer re-statement (refunds, credits) overwrites rather
  // than doubles. The delete is scoped to the exact period so historical rows outside
  // the window are untouched.
  const rows = [...awsSnapshots, ...azureSnapshots];
  if (rows.length > 0) {
    await db
      .delete(costSnapshots)
      .where(
        sql`${costSnapshots.periodStart} >= ${new Date(range.startDate)} AND ${costSnapshots.periodEnd} <= ${new Date(range.endDate + "T23:59:59Z")}`,
      );
    await db.insert(costSnapshots).values(rows);
  }

  const finishedAt = new Date();
  const status: CostSyncStatus = providers.every((p) => p.status === "ok")
    ? "ok"
    : providers.some((p) => p.status === "ok")
      ? "partial"
      : "error";

  return {
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    range,
    providers,
    totalRows: rows.length,
  };
}

function summarizeProvider(
  provider: "aws" | "azure",
  rows: { amount: number; currency: string }[] | null,
  snapshotCount: number,
): CostProviderSummary {
  if (rows === null) {
    return {
      provider,
      status: "error",
      rowCount: 0,
      totalSpend: 0,
      currency: "USD",
      error: "pull failed — see server logs",
    };
  }
  const totalSpend = rows.reduce((sum, r) => sum + r.amount, 0);
  const currency = rows[0]?.currency ?? "USD";
  return {
    provider,
    status: "ok",
    rowCount: snapshotCount,
    totalSpend,
    currency,
  };
}
