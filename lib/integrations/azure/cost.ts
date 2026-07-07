import "server-only";

import type { TokenCredential } from "@azure/identity";

import { cacheable } from "@/lib/cache";
import type { NewCostSnapshot } from "@/db/schema";
import type { CostSourceError } from "@/lib/integrations/types";

import { createAzureCredential, readAzureEnv, resolveSubscription } from "./client";

/**
 * Azure Cost Management adapter — READ-ONLY.
 *
 * Pulls actual cost from the Azure Cost Management `query` REST API for the resolved
 * subscription, grouped by ServiceName. The response is memoized behind a long TTL via
 * `cacheable()` so repeated dashboard loads never re-hit the (rate-limited) API.
 *
 * Cost Management is exposed at the management-plane endpoint
 * `https://management.azure.com` and authenticated with the same Service Principal
 * `TokenCredential` the rest of the Azure integration uses. We acquire an ARM-scoped
 * bearer token via `getToken()` and issue a single `fetch` — no unstable beta SDK
 * dependency required.
 */

/** 6h — matches the AWS cost cache window so a cross-cloud view stays consistent. */
const CACHE_TTL_SECONDS = 6 * 60 * 60;

const ARM_SCOPE = "https://management.azure.com/.default";
const API_VERSION = "2024-08-01";

export interface AzureCostOptions {
  /** Inclusive start (YYYY-MM-DD). */
  startDate: string;
  /** Exclusive end (YYYY-MM-DD). */
  endDate: string;
  /** DAILY or MONTHLY granularity (default DAILY). */
  granularity?: "DAILY" | "MONTHLY";
}

/** A single normalized cost row, ready to insert into `cost_snapshots`. */
export interface AzureCostRow {
  provider: "azure";
  account: string;
  service: string | null;
  tagProduct: string | null;
  amount: number;
  currency: string;
  granularity: "DAILY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
}

interface CostQueryRow {
  properties?: {
    Cost?: number;
    Currency?: string;
    ServiceName?: string;
    UsageStart?: string;
    UsageEnd?: string;
    BillableSubscriptionId?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface CostQueryResponse {
  id?: string;
  name?: string;
  type?: string;
  properties?: {
    columns?: Array<{ name: string; type: string }>;
    rows?: unknown[][];
  };
  error?: { code?: string; message?: string };
}

export interface AzureCostResult {
  rows: AzureCostRow[];
  errors: CostSourceError[];
  /** False when no Azure Service Principal is configured — the pull never ran. */
  configured: boolean;
}

/**
 * Discover Azure costs for the configured subscription over the given date range.
 * Every failure mode (missing config, unresolvable subscription, denied query) is
 * surfaced as a `CostSourceError` rather than a silent empty result, and a result
 * carrying errors is never cached so a transient failure can't pin the whole TTL.
 */
export async function getAzureCosts(opts: AzureCostOptions): Promise<AzureCostResult> {
  const cacheKey = `truesight:azure:costs:${opts.startDate}:${opts.endDate}:${opts.granularity ?? "DAILY"}`;
  return cacheable(
    cacheKey,
    CACHE_TTL_SECONDS,
    async (): Promise<AzureCostResult> => {
      let env;
      try {
        env = readAzureEnv();
      } catch (err) {
        // A wholly-absent Service Principal means Azure isn't connected at all;
        // a partial config is an operator error that must surface.
        const configured = [
          process.env.AZURE_TENANT_ID,
          process.env.AZURE_CLIENT_ID,
          process.env.AZURE_CLIENT_SECRET,
          process.env.AZURE_SUBSCRIPTION_NAME,
        ].some((v) => Boolean(v?.trim()));
        return {
          rows: [],
          errors: configured
            ? [{ scope: "azure:config", message: (err as Error)?.message ?? String(err) }]
            : [],
          configured,
        };
      }
      const granularity = opts.granularity ?? "DAILY";

      // Resolve the subscription id once (cached upstream); Cost Management scopes to it.
      // The credential constructor validates its inputs, so it lives inside the try.
      let credential;
      let sub;
      try {
        credential = createAzureCredential(env);
        sub = await resolveSubscription(credential, env.subscriptionName);
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        console.warn(
          `[azure-cost] could not resolve subscription "${env.subscriptionName}":`,
          e?.message ?? err,
        );
        return {
          rows: [],
          errors: [
            {
              scope: `azure:${env.subscriptionName}`,
              message: e?.message ?? String(err),
              code: e?.name,
              statusCode: e?.statusCode,
            },
          ],
          configured: true,
        };
      }

      try {
        const rows = await queryCost(credential, sub.subscriptionId, opts, granularity);
        return { rows, errors: [], configured: true };
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        console.warn(
          `[azure-cost:${sub.subscriptionId}] Cost Management query failed:`,
          e?.message ?? err,
        );
        const denied = e?.statusCode === 401 || e?.statusCode === 403;
        return {
          rows: [],
          errors: [
            {
              scope: `azure:${sub.subscriptionId}`,
              message: denied
                ? "Grant Cost Management Reader to the service principal at subscription scope"
                : (e?.message ?? String(err)),
              code: e?.name,
              statusCode: e?.statusCode,
            },
          ],
          configured: true,
        };
      }
    },
    { shouldCache: (v) => v.configured && v.errors.length === 0 },
  );
}

/** Run the Cost Management `query` REST call and map the response to normalized rows. */
async function queryCost(
  credential: TokenCredential,
  subscriptionId: string,
  opts: AzureCostOptions,
  granularity: "DAILY" | "MONTHLY",
): Promise<AzureCostRow[]> {
  const token = await credential.getToken(ARM_SCOPE);
  if (!token?.token) {
    throw new Error("Failed to acquire ARM access token for Cost Management.");
  }

  const scope = `/subscriptions/${subscriptionId}`;
  const url =
    `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query` +
    `?api-version=${API_VERSION}`;

  const body = {
    type: "ActualCost",
    timeframe: "Custom",
    timePeriod: {
      from: opts.startDate,
      to: opts.endDate,
    },
    dataset: {
      granularity,
      aggregation: {
        totalCost: { name: "Cost", function: "Sum" },
      },
      grouping: [
        { type: "Dimension", name: "ServiceName" },
      ],
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    // Cost Management can be slow on cold caches; give it generous room to respond.
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(
      `Cost Management HTTP ${resp.status}: ${text.slice(0, 300)}`,
    ) as Error & { statusCode?: number };
    // Carry the HTTP status so the caller can map 401/403 to a remediation hint.
    err.statusCode = resp.status;
    throw err;
  }

  const payload = (await resp.json()) as CostQueryResponse;
  if (payload.error) {
    throw new Error(`${payload.error.code ?? "CostError"}: ${payload.error.message ?? "unknown"}`);
  }

  return mapResponse(payload, subscriptionId, granularity);
}

/**
 * Cost Management returns a columnar result (a `columns` header + parallel `rows`).
 * We resolve column indices by name so the adapter is resilient to API ordering changes,
 * then project each row onto a normalized cost row.
 */
function mapResponse(
  payload: CostQueryResponse,
  subscriptionId: string,
  granularity: "DAILY" | "MONTHLY",
): AzureCostRow[] {
  const columns = payload.properties?.columns ?? [];
  const rows = payload.properties?.rows ?? [];

  const idxFor = (name: string): number => columns.findIndex((c) => c.name === name);

  const iCost = idxFor("Cost");
  const iCurrency = idxFor("Currency");
  const iService = idxFor("ServiceName");
  // The dataset's start date column is named "UsageDate" (DAILY, int YYYYMMDD) or
  // "BillingMonth" / "Month" depending on granularity; fall back across the variants.
  const iStart =
    idxFor("UsageDate") >= 0
      ? idxFor("UsageDate")
      : idxFor("BillingMonth") >= 0
        ? idxFor("BillingMonth")
        : idxFor("Month");
  const iEnd = idxFor("UsageEnd");

  const out: AzureCostRow[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cell = (i: number): unknown => (i >= 0 ? row[i] : undefined);

    const amount = Number(cell(iCost) ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const currency = String(cell(iCurrency) ?? "USD");
    const serviceName = cell(iService);
    const service = typeof serviceName === "string" && serviceName.trim() ? serviceName : null;

    const { periodStart, periodEnd } = parsePeriod(cell(iStart), cell(iEnd), granularity);

    out.push({
      provider: "azure",
      account: subscriptionId,
      service,
      tagProduct: null,
      amount,
      currency,
      granularity,
      periodStart,
      periodEnd,
    });
  }
  return out;
}

/**
 * Normalize the period boundaries to ISO date strings. `UsageDate` is an integer
 * YYYYMMDD for DAILY granularity; the `UsageEnd` column (ISO) is preferred when present.
 */
function parsePeriod(
  startCell: unknown,
  endCell: unknown,
  granularity: "DAILY" | "MONTHLY",
): { periodStart: string; periodEnd: string } {
  if (typeof startCell === "number") {
    // YYYYMMDD integer → YYYY-MM-DD.
    const s = String(startCell).padStart(8, "0");
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const d = new Date(iso);
    const end = new Date(d.getTime() + (granularity === "DAILY" ? 86_400_000 : 30 * 86_400_000));
    return { periodStart: iso, periodEnd: end.toISOString().slice(0, 10) };
  }
  const start = typeof startCell === "string" ? startCell : new Date().toISOString().slice(0, 10);
  const end = typeof endCell === "string" ? endCell : start;
  return { periodStart: start, periodEnd: end };
}

/** Map a set of Azure cost rows to `cost_snapshots` insert rows. */
export function toCostSnapshots(rows: AzureCostRow[]): NewCostSnapshot[] {
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
