import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import {
  costRollups,
  costSnapshots,
  integrationAccounts,
  integrationSync,
  type NewCostSnapshot,
} from "@/db/schema";
import { invalidatePrefix } from "@/lib/cache";
import { COST_SOURCES } from "@/lib/integrations/cost-sources";
import type { CostSourceError } from "@/lib/integrations/types";

import {
  getAwsCosts,
  toCostSnapshots as awsToSnapshots,
  type AwsCostResult,
} from "@/lib/integrations/aws/cost";
import {
  getAzureCosts,
  toCostSnapshots as azureToSnapshots,
  type AzureCostResult,
} from "@/lib/integrations/azure/cost";

type Db = PostgresJsDatabase<typeof schema>;

export type CostSyncStatus = "ok" | "partial" | "error";
export type CostSyncTrigger = "manual" | "scheduled";

export interface CostProviderSummary {
  provider: "aws" | "azure";
  status: CostSyncStatus;
  /** False when the provider has no cost source configured — nothing was pulled. */
  configured: boolean;
  rowCount: number;
  totalSpend: number;
  currency: string;
  errors: CostSourceError[];
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
  trigger?: CostSyncTrigger;
}): Promise<CostSyncSummary> {
  const db: Db = opts?.db ?? ((await import("@/db")).db as unknown as Db);
  const range = opts?.startDate && opts?.endDate
    ? { startDate: opts.startDate, endDate: opts.endDate }
    : defaultCostRange();
  const granularity = opts?.granularity ?? "DAILY";
  const trigger = opts?.trigger ?? "manual";
  const startedAt = new Date();

  const ceOpts = { ...range, granularity };

  // Pull both providers concurrently; each adapter reports its failures as
  // per-scope `CostSourceError`s instead of throwing or silently returning [].
  // The `.catch` guards are a safety net: an unexpected rejection (env parse,
  // credential constructor) degrades into the same honest error channel.
  const [awsResult, azureResult] = await Promise.all([
    getAwsCosts({ ...ceOpts, tagKey: opts?.tagKey }).catch(
      (err: unknown): AwsCostResult => ({
        rows: [],
        errors: [{ scope: "aws:adapter", message: (err as Error)?.message ?? String(err) }],
        configured: true,
      }),
    ),
    getAzureCosts(ceOpts).catch(
      (err: unknown): AzureCostResult => ({
        rows: [],
        errors: [{ scope: "azure:adapter", message: (err as Error)?.message ?? String(err) }],
        configured: true,
      }),
    ),
  ]);

  const awsSnapshots = awsToSnapshots(awsResult.rows);
  const azureSnapshots = azureToSnapshots(azureResult.rows);

  const providers: CostProviderSummary[] = [
    summarizeProvider("aws", awsResult, awsSnapshots.length),
    summarizeProvider("azure", azureResult, azureSnapshots.length),
  ];

  // Persist: clear the same window first, then insert fresh rows. This keeps the table
  // authoritative — a Cost Explorer re-statement (refunds, credits) overwrites rather
  // than doubles. The delete is scoped to the exact period AND to the provider — and,
  // on a partial pull, to the accounts that actually returned rows — so a failed
  // provider or account can never lose its previously-good window.
  const perProvider: Array<{
    provider: CostProviderSummary["provider"];
    snapshots: NewCostSnapshot[];
    errors: CostSourceError[];
    configured: boolean;
  }> = [
    {
      provider: "aws",
      snapshots: awsSnapshots,
      errors: awsResult.errors,
      configured: awsResult.configured,
    },
    {
      provider: "azure",
      snapshots: azureSnapshots,
      errors: azureResult.errors,
      configured: azureResult.configured,
    },
  ];

  let totalRows = 0;
  let windowsReplaced = 0;
  for (const { provider, snapshots, errors, configured } of perProvider) {
    // An unconfigured provider was never pulled; a pull that errored with zero
    // rows has nothing trustworthy to replace the window with. Rows stay put.
    if (!configured || (snapshots.length === 0 && errors.length > 0)) continue;
    const accounts = [
      ...new Set(snapshots.map((s) => s.account).filter((a): a is string => Boolean(a))),
    ];
    await db
      .delete(costSnapshots)
      .where(
        and(
          eq(costSnapshots.provider, provider),
          // Partial pull: only replace the accounts that actually returned rows.
          errors.length > 0 ? inArray(costSnapshots.account, accounts) : undefined,
          // ISO strings, not Date objects: raw sql`` params bypass the column
          // mapper, and postgres.js serializes an inline Date as an invalid
          // string arg (ERR_INVALID_ARG_TYPE). Postgres casts text→timestamptz.
          // Windowed on period_start (like every cost read) so an inclusive-end
          // source (Azure's `to` day carries period_end = end + 1) still matches.
          sql`${costSnapshots.periodStart} >= ${new Date(range.startDate).toISOString()} AND ${costSnapshots.periodStart} <= ${new Date(range.endDate + "T23:59:59Z").toISOString()}`,
        ),
      );
    if (snapshots.length > 0) {
      await db.insert(costSnapshots).values(snapshots);
      totalRows += snapshots.length;
    }
    windowsReplaced += 1;
  }
  if (windowsReplaced > 0) {
    await recomputeCostRollups(db);
  }

  const finishedAt = new Date();
  const active = providers.filter((p) => p.configured);
  const status: CostSyncStatus =
    active.length === 0 || active.every((p) => p.status === "error")
      ? "error"
      : active.every((p) => p.status === "ok")
        ? "ok"
        : "partial";

  // Run history is best-effort: the snapshots are already committed, so a
  // bookkeeping failure must not turn a successful sync into a fatal crash.
  try {
    await recordSyncOutcomes(db, providers, startedAt, finishedAt, trigger);
  } catch (err) {
    console.error(
      "[cost-sync] failed to record sync run history:",
      (err as Error)?.message ?? err,
    );
  }

  return {
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    range,
    providers,
    totalRows,
  };
}

/**
 * Record each provider's outcome as an integration_sync run (under a stable
 * integration_accounts identity, e.g. aws/cost-explorer) so cost pulls show up in the
 * same run history as estate discovery — including the errors an operator needs to fix.
 * A provider with nothing configured records no run — it was never pulled.
 */
async function recordSyncOutcomes(
  db: Db,
  providers: CostProviderSummary[],
  startedAt: Date,
  finishedAt: Date,
  trigger: CostSyncTrigger,
): Promise<void> {
  for (const p of providers) {
    if (!p.configured) continue;
    const source = COST_SOURCES[p.provider];
    const [acct] = await db
      .insert(integrationAccounts)
      .values({
        provider: p.provider,
        externalId: source.externalId,
        displayName: source.displayName,
      })
      .onConflictDoUpdate({
        target: [integrationAccounts.provider, integrationAccounts.externalId],
        set: { displayName: source.displayName },
      })
      .returning({ id: integrationAccounts.id });

    await db.insert(integrationSync).values({
      accountId: acct.id,
      startedAt,
      finishedAt,
      status: p.status,
      resourceCount: p.rowCount,
      errorCount: p.errors.length,
      errors: p.errors.length > 0 ? p.errors : null,
      trigger,
    });
  }
}

/**
 * Recompute the precomputed `cost_rollups` aggregate (provider/account/service/day)
 * from `cost_snapshots`, atomically (delete+insert in one tx) so cost reads never
 * observe a half-written table. Best-effort: the snapshots are already persisted, so
 * a rollup failure degrades to stale aggregates (next sync repairs) rather than
 * failing the whole sync.
 */
async function recomputeCostRollups(db: Db): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(costRollups);
      await tx.execute(sql`
        insert into cost_rollups (provider, account, service, day, amount, currency)
        select provider, account, service,
               date_trunc('day', period_start at time zone 'UTC') at time zone 'UTC' as day,
               sum(amount::numeric),
               min(currency)
        from cost_snapshots
        group by provider, account, service, 4
      `);
    });
    // Warm cost: reads are now stale — drop them (TTL covers any failure here).
    await invalidatePrefix("cost:");
  } catch (err) {
    console.warn("[cost-sync] rollup recompute failed:", (err as Error)?.message ?? err);
  }
}

/**
 * ok      — rows came back, no scope failed
 * partial — rows came back, but at least one scope (account/subscription) failed
 * error   — nothing came back and at least one scope failed
 */
function summarizeProvider(
  provider: CostProviderSummary["provider"],
  result: {
    rows: { amount: number; currency: string }[];
    errors: CostSourceError[];
    configured: boolean;
  },
  snapshotCount: number,
): CostProviderSummary {
  const { rows, errors, configured } = result;
  const totalSpend = rows.reduce((sum, r) => sum + r.amount, 0);
  const currency = rows[0]?.currency ?? "USD";
  const status: CostSyncStatus =
    errors.length === 0 ? "ok" : rows.length > 0 ? "partial" : "error";
  return {
    provider,
    status,
    configured,
    rowCount: snapshotCount,
    totalSpend,
    currency,
    errors,
  };
}
