import type { Metadata } from "next";
import { Wallet } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { RollupNumber } from "@/components/ui/RollupNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { CostTile } from "@/components/widgets/CostTile";

import { getCostOverview, resolveCostRange, type CostRangeKey } from "./data";
import { CostRangeFilter } from "./CostRangeFilter";
import { CostSyncButton } from "./CostSyncButton";

export const metadata: Metadata = { title: "Cost & FinOps" };
export const dynamic = "force-dynamic";

const VALID_RANGES: CostRangeKey[] = ["7d", "30d", "90d", "mtd"];

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
  const cost = await getCostOverview(range);
  const { endDate } = resolveCostRange(range);

  const totalSpark = cost.series.map((p) => p.aws + p.azure);
  const awsSpark = cost.series.map((p) => p.aws);
  const azureSpark = cost.series.map((p) => p.azure);
  const dailySpark = cost.series.map((p) => p.aws + p.azure);

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
          <div className="hidden shrink-0 sm:block">
            <CostRangeFilter value={range} />
          </div>
        </header>
      </Reveal>

      {!cost.hasData ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Wallet size={24} strokeWidth={1.5} />}
            title="Argus hasn't captured cost data yet"
            description="Run a cost sync to pull actual spend from AWS Cost Explorer and Azure Cost Management — read-only. Spend will appear here grouped by provider and service."
            action={<CostSyncButton />}
          />
        </Reveal>
      ) : (
        <>
          {/* Summary stat row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Reveal delay={0 * 0.06}>
              <CostTile
                label={`Total spend · ${range}`}
                amount={cost.total}
                sparklineData={totalSpark}
                provider={undefined}
              />
            </Reveal>
            <Reveal delay={1 * 0.06}>
              <CostTile label="AWS spend" amount={cost.aws} sparklineData={awsSpark} provider="aws" />
            </Reveal>
            <Reveal delay={2 * 0.06}>
              <CostTile
                label="Azure spend"
                amount={cost.azure}
                sparklineData={azureSpark}
                provider="azure"
              />
            </Reveal>
            <Reveal delay={3 * 0.06}>
              <CostTile label="Daily average" amount={cost.dailyAvg} sparklineData={dailySpark} />
            </Reveal>
          </div>

          {/* Mobile range filter (desktop lives in the header) */}
          <div className="mt-4 sm:hidden">
            <CostRangeFilter value={range} />
          </div>

          {/* Total trend */}
          <Reveal delay={0.12}>
            <Surface level={1} radius="lg" className="mt-4 p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[16px] font-medium leading-[1.4] text-ink">
                  Spend trend
                </h2>
                <span className="font-display text-[24px] font-medium tabular-nums text-ink">
                  <RollupNumber value={cost.total} prefix="$" decimals={2} />
                </span>
              </div>
              <div className="mt-4">
                {totalSpark.length >= 2 ? (
                  <Sparkline data={totalSpark} width={900} height={64} strokeWidth={2} className="w-full" />
                ) : (
                  <p className="text-[13px] text-mute">
                    Not enough daily data points to plot a trend yet.
                  </p>
                )}
              </div>
              <p className="mt-3 text-[12px] text-mute">
                Window ends {endDate} · {cost.series.length} daily points · {cost.currency}
              </p>
            </Surface>
          </Reveal>

          {/* Provider breakdown */}
          <Reveal delay={0.18}>
            <Surface level={1} radius="lg" className="mt-4 p-6">
              <h2 className="text-[16px] font-medium leading-[1.4] text-ink">By provider</h2>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <ProviderRow provider="aws" amount={cost.aws} total={cost.total} />
                <ProviderRow provider="azure" amount={cost.azure} total={cost.total} />
              </div>
            </Surface>
          </Reveal>

          {/* Service breakdown */}
          <Reveal delay={0.24}>
            <Surface level={1} radius="lg" className="mt-4 overflow-hidden">
              <div className="border-b border-hairline px-6 py-4">
                <h2 className="text-[16px] font-medium leading-[1.4] text-ink">
                  Cost by service
                </h2>
              </div>
              <div className="divide-y divide-hairline">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-2 text-[12px] uppercase tracking-[0.08em] text-mute">
                  <span>Service</span>
                  <span className="w-32 text-right">Trend</span>
                  <span className="w-28 text-right">Amount</span>
                </div>
                {cost.byService.map((s) => (
                  <div
                    key={`${s.provider}:${s.service}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProviderChip provider={s.provider} label={false} />
                      <span className="truncate text-[14px] text-ink">{s.service}</span>
                    </div>
                    <div className="w-32">
                      {s.sparkline.length >= 2 ? (
                        <Sparkline data={s.sparkline} width={128} height={24} className="ml-auto" />
                      ) : (
                        <span className="block text-right text-[12px] text-mute">—</span>
                      )}
                    </div>
                    <span className="w-28 text-right font-mono text-[14px] tabular-nums text-ink">
                      <RollupNumber value={s.amount} prefix="$" decimals={2} />
                    </span>
                  </div>
                ))}
              </div>
            </Surface>
          </Reveal>
        </>
      )}
    </div>
  );
}

function ProviderRow({
  provider,
  amount,
  total,
}: {
  provider: "aws" | "azure";
  amount: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <ProviderChip provider={provider} />
      <span className="font-display text-[22px] font-medium tabular-nums text-ink">
        <RollupNumber value={amount} prefix="$" decimals={2} />
      </span>
      <span className="text-[13px] text-mute">{pct}%</span>
    </div>
  );
}
