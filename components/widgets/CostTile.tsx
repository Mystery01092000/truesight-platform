import { Surface } from "@/components/ui/Surface";
import { RollupNumber } from "@/components/ui/RollupNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import { ProviderChip } from "@/components/ui/ProviderChip";
import type { CloudProvider } from "@/lib/taxonomy";

/**
 * CostTile — a compact cost statistic card. Surface(1) chrome with the label in
 * `text-mute`, the amount in `font-display` count-up via RollupNumber, and a Sparkline
 * trend across the bottom. An optional ProviderChip identifies the cloud when a tile is
 * scoped to a single provider. Monochrome by default; accent appears only in the
 * Sparkline stroke (the system's one permitted accent surface for data).
 */
export type CostTileProps = {
  label: string;
  amount: number;
  /** Optional daily/period series rendered as a Sparkline. */
  sparklineData?: number[];
  /** Optional single-provider scope chip. */
  provider?: CloudProvider;
  /** Prefix for the amount (default "$"). */
  prefix?: string;
  /** Decimal places for the amount (default 2). */
  decimals?: number;
};

export function CostTile({
  label,
  amount,
  sparklineData,
  provider,
  prefix = "$",
  decimals = 2,
}: CostTileProps) {
  return (
    <Surface level={1} radius="lg" className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-mute">{label}</span>
        {provider ? <ProviderChip provider={provider} /> : null}
      </div>
      <div className="font-display text-[28px] font-medium leading-none tracking-[-0.3px] text-ink">
        <RollupNumber value={amount} prefix={prefix} decimals={decimals} />
      </div>
      {sparklineData && sparklineData.length >= 2 ? (
        <Sparkline data={sparklineData} width={220} height={32} className="mt-auto w-full" />
      ) : null}
    </Surface>
  );
}
