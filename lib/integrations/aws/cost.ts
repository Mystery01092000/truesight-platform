import "server-only";

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GroupDefinition,
} from "@aws-sdk/client-cost-explorer";

import { serverEnv } from "@/lib/config/env";
import { cacheable } from "@/lib/cache";
import type { NewCostSnapshot } from "@/db/schema";

import { createClientFactory } from "./client";

/**
 * AWS Cost Explorer adapter — READ-ONLY.
 *
 * Pulls `GetCostAndUsage` for a date range + granularity, grouped by SERVICE and
 * (optionally) by a cost-allocation TAG (e.g. `Project`). Cost Explorer is a global
 * service that bills ~$0.01 per request, so every call is memoized behind a long TTL
 * via `cacheable()` — repeated dashboard loads and API reads hit the cache, not AWS.
 *
 * Cost Explorer reports on the *linked* (payer) account; for member accounts it only
 * returns that member's own spend. We therefore call it once per configured account
 * (management + prod) using that account's resolved credentials, so the platform shows
 * per-account spend alongside a rolled-up total.
 *
 * Discovery is read-only by construction: this module only ever calls `GetCostAndUsage`.
 */

/** Cost Explorer's global home region — the API is not regional. */
const CE_REGION = "us-east-1";

/** 6h: long enough to absorb a day's dashboard traffic, short enough to stay fresh. */
const CACHE_TTL_SECONDS = 6 * 60 * 60;

export interface AwsCostOptions {
  /** Inclusive start (YYYY-MM-DD). */
  startDate: string;
  /** Exclusive end (YYYY-MM-DD). */
  endDate: string;
  /** DAILY or MONTHLY granularity (default DAILY). */
  granularity?: "DAILY" | "MONTHLY";
  /** Cost-allocation tag key to group by in addition to SERVICE (e.g. "Project"). */
  tagKey?: string;
}

/** A single normalized cost row, ready to insert into `cost_snapshots`. */
export interface AwsCostRow {
  provider: "aws";
  account: string;
  service: string | null;
  tagProduct: string | null;
  amount: number;
  currency: string;
  granularity: "DAILY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
}

interface AccountConfig {
  accountId: string;
  label: string;
}

/**
 * Discover AWS costs across every configured account (management + prod). Each account
 * is queried independently and its results merged; a per-account failure is recorded as
 * an empty result + a logged warning rather than aborting the whole pull.
 */
export async function getAwsCosts(opts: AwsCostOptions): Promise<AwsCostRow[]> {
  const cacheKey = `argus:aws:costs:${opts.startDate}:${opts.endDate}:${opts.granularity ?? "DAILY"}:${opts.tagKey ?? ""}`;
  return cacheable(cacheKey, CACHE_TTL_SECONDS, async () => {
    const env = serverEnv();
    const accounts: AccountConfig[] = [];
    if (env.AWS_MGMT_ACCOUNT_ID) {
      accounts.push({ accountId: env.AWS_MGMT_ACCOUNT_ID, label: "AWS Management" });
    }
    if (env.AWS_PROD_ACCOUNT_ID) {
      accounts.push({ accountId: env.AWS_PROD_ACCOUNT_ID, label: "AWS Production" });
    }
    if (accounts.length === 0) return [];

    const granularity = opts.granularity ?? "DAILY";
    const out: AwsCostRow[] = [];
    for (const acct of accounts) {
      try {
        const rows = await queryAccount(acct.accountId, opts, granularity);
        out.push(...rows);
      } catch (err) {
        // A single account failing (missing CE permissions, SCP, etc.) must not take
        // down the whole cost sync — degrade to that account's omission + a log line.
        console.warn(
          `[aws-cost:${acct.accountId}] failed to read Cost Explorer:`,
          (err as Error)?.message ?? err,
        );
      }
    }
    return out;
  });
}

/** Query one account's Cost Explorer, grouped by SERVICE (+ optional TAG). */
async function queryAccount(
  accountId: string,
  opts: AwsCostOptions,
  granularity: "DAILY" | "MONTHLY",
): Promise<AwsCostRow[]> {
  const factory = createClientFactory(accountId);
  // Cost Explorer is global; always pin to us-east-1 regardless of the account's
  // discovery region. The factory memoizes clients per (account, ctor, region).
  const ce = factory.get(CostExplorerClient, { region: CE_REGION });

  const groupBy: GroupDefinition[] = [{ Type: "DIMENSION", Key: "SERVICE" }];
  if (opts.tagKey) {
    groupBy.push({ Type: "TAG", Key: opts.tagKey });
  }

  const resultsByTime: AwsCostRow[] = [];
  let nextToken: string | undefined;

  do {
    const res = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: opts.startDate, End: opts.endDate },
        Granularity: granularity,
        Metrics: ["UnblendedCost"],
        GroupBy: groupBy,
        NextPageToken: nextToken,
      }),
    );

    for (const bucket of res.ResultsByTime ?? []) {
      const periodStart = bucket.TimePeriod?.Start ?? opts.startDate;
      const periodEnd = bucket.TimePeriod?.End ?? opts.endDate;
      for (const group of bucket.Groups ?? []) {
        const serviceKey = group.Keys?.[0] ?? "";
        const tagKey = group.Keys?.[1] ?? "";
        const amountStr = group.Metrics?.["UnblendedCost"]?.Amount;
        const unit = group.Metrics?.["UnblendedCost"]?.Unit ?? "USD";
        if (!amountStr) continue;

        // AWS uses "$0.00" as the SERVICE dimension key for untagged/Amortized residual
        // spend; normalize that to null so the UI groups it under "Other".
        const service = serviceKey && serviceKey !== "$0.00" ? serviceKey : null;
        const tagProduct = opts.tagKey && tagKey ? tagKey : null;

        resultsByTime.push({
          provider: "aws",
          account: accountId,
          service,
          tagProduct,
          amount: Number(amountStr),
          currency: unit,
          granularity,
          periodStart,
          periodEnd,
        });
      }
    }

    nextToken = res.NextPageToken;
  } while (nextToken);

  return resultsByTime;
}

/** Map a set of AWS cost rows to `cost_snapshots` insert rows. */
export function toCostSnapshots(rows: AwsCostRow[]): NewCostSnapshot[] {
  return rows.map((r) => ({
    provider: r.provider,
    account: r.account,
    service: r.service,
    tagProduct: r.tagProduct,
    amount: r.amount.toFixed(6),
    currency: r.currency,
    granularity: r.granularity,
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
  }));
}
