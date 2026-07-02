import type { Metadata } from "next";
import { Activity, ArrowLeftRight, Layers, Wallet } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { Sparkline } from "@/components/ui/Sparkline";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { CostBreakdown } from "@/components/widgets/CostBreakdown";
import { CostLineItemsTable } from "@/components/widgets/CostLineItemsTable";

import { getCostConsole, type CostRangeKey } from "./data";
import { CostRangeFilter } from "./CostRangeFilter";
import { CostSyncButton } from "./CostSyncButton";

export const metadata: Metadata = { title: "Cost & FinOps" };
export const dynamic = "force-dynamic";

const VALID_RANGES: CostRangeKey[] = ["7d", "30d", "90d", "mtd"];

const RANGE_LABEL: Record<CostRangeKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  mtd: "month to date",
};

function normalizeRange(v: string | string[] | undefined): CostRangeKey {
  const s = Array.isArray(v) ? v[0] : v;
  return (VALID_RANGES as readonly string[]).includes(s ?? "") ? (s as CostRangeKey) : "30d";
}

export default async function CostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = normalizeRange(sp.range);
  const cost = await getCostConsole(range);

  const dailyTotals = cost.series.map((p) => p.aws + p.azure);

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-card"
            aria-hidden
          >
            <Wallet size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Cost &amp; FinOps
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Cross-cloud spend, read-only from AWS Cost Explorer and Azure Cost Management.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <CostRangeFilter value={range} />
            {cost.hasData ? <CostSyncButton variant="tertiary" size="sm" label="Re-sync" /> : null}
          </div>
        </header>
      </Reveal>

      {!cost.hasData ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Wallet size={24} strokeWidth={1.5} />}
            title="Argus hasn't captured cost data yet"
            description="Run a cost sync to pull actual spend from AWS Cost Explorer and Azure Cost Management — read-only. Spend will appear here grouped by provider, account, service and day."
            action={<CostSyncButton />}
          />
        </Reveal>
      ) : (
        <>
          {/* Stat row — current spend, delta vs previous window, top service, daily burn */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Reveal delay={0}>
              <StatTile
                label={`Total spend · ${RANGE_LABEL[range]}`}
                value={cost.total}
                prefix="$"
                decimals={2}
                icon={<Wallet />}
                sparkline={
                  <p className="font-mono text-micro tabular-nums text-ash">
                    {cost.startDate} → {cost.endDate}
                  </p>
                }
              />
            </Reveal>
            <Reveal delay={0.04}>
              <StatTile
                label="vs previous period"
                value={cost.prevTotal}
                prefix="$"
                decimals={2}
                icon={<ArrowLeftRight />}
                delta={cost.deltaPct ?? undefined}
                deltaInverted
                deltaSuffix="%"
                sparkline={
                  <p className="font-mono text-micro tabular-nums text-ash">
                    {cost.prevTotal > 0
                      ? `${cost.prevStartDate} → ${cost.prevEndDate}`
                      : "no spend captured in the prior window"}
                  </p>
                }
              />
            </Reveal>
            <Reveal delay={0.08}>
              <StatTile
                label="Top service"
                value={cost.topService?.amount ?? 0}
                prefix="$"
                decimals={2}
                icon={<Layers />}
                sparkline={
                  cost.topService ? (
                    <p className="flex items-center gap-1.5 text-[12px] leading-[1.5] text-mute">
                      <ProviderChip provider={cost.topService.provider} label={false} />
                      <span className="truncate">{cost.topService.service}</span>
                    </p>
                  ) : (
                    <p className="text-micro text-ash">no service-level spend recorded</p>
                  )
                }
              />
            </Reveal>
            <Reveal delay={0.12}>
              <StatTile
                label="Daily burn"
                value={cost.dailyAvg}
                prefix="$"
                decimals={2}
                icon={<Activity />}
                sparkline={
                  dailyTotals.length >= 2 ? (
                    <Sparkline data={dailyTotals} width={220} height={32} className="w-full" />
                  ) : (
                    <p className="text-micro text-ash">not enough daily points to plot yet</p>
                  )
                }
              />
            </Reveal>
          </div>

          {/* Mobile controls (desktop lives in the header) */}
          <div className="mt-4 flex items-center justify-between gap-3 sm:hidden">
            <CostRangeFilter value={range} />
            <CostSyncButton variant="tertiary" size="sm" label="Re-sync" />
          </div>

          {/* Breakdown explorer */}
          <Reveal delay={0.16}>
            <Surface level={1} radius="lg" className="mt-4 p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-medium leading-[1.4] text-ink">Spend breakdown</h2>
                <span className="font-mono text-micro tabular-nums text-ash">
                  {cost.series.length} daily points · {cost.currency} ·{" "}
                  {cost.source === "rollups" ? "precomputed rollups" : "snapshot aggregates"}
                </span>
              </div>
              <CostBreakdown groups={cost.breakdowns} awsTotal={cost.aws} azureTotal={cost.azure} />
            </Surface>
          </Reveal>

          {/* Line-item drill-down */}
          <Reveal delay={0.22}>
            <section className="mt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-medium leading-[1.4] text-ink">Line items</h2>
                <span className="font-mono text-micro tabular-nums text-ash">
                  {cost.lineItems.length < cost.lineItemsTotal
                    ? `top ${cost.lineItems.length.toLocaleString("en-US")} of ${cost.lineItemsTotal.toLocaleString("en-US")} rows by recency + spend`
                    : `${cost.lineItemsTotal.toLocaleString("en-US")} rows · provider / account / service / day grain`}
                </span>
              </div>
              <CostLineItemsTable rows={cost.lineItems} facets={cost.facets} />
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}
