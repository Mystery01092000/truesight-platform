import { cn } from "@/lib/utils/cn";
import { RollupNumber } from "@/components/ui/RollupNumber";

/**
 * StatTile — the standard KPI tile: a quiet label, a live RollupNumber in mono
 * tabular figures, an optional signed delta badge in the semantic status pair
 * (positive/critical soft fill + accent text) and an optional sparkline slot.
 * One of the rare deliberate places saturated color reads on chrome.
 */
export type StatTileProps = {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Signed change vs. the previous period; renders as a +/− badge. */
  delta?: number;
  /** Set when a rising number is bad (cost, findings) so colors invert. */
  deltaInverted?: boolean;
  /** Suffix on the delta badge (e.g. "%"). */
  deltaSuffix?: string;
  /** Small leading glyph, rendered at the top-right in ash. */
  icon?: React.ReactNode;
  /** Sparkline slot, rendered under the value (e.g. <Sparkline />). */
  sparkline?: React.ReactNode;
  className?: string;
};

export function StatTile({
  label,
  value,
  decimals = 0,
  prefix,
  suffix,
  delta,
  deltaInverted = false,
  deltaSuffix = "",
  icon,
  sparkline,
  className,
}: StatTileProps) {
  const good = deltaInverted ? (delta ?? 0) < 0 : (delta ?? 0) > 0;

  return (
    <div className={cn("rounded-lg border border-hairline bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium leading-[1.5] tracking-[0.015em] text-mute">
          {label}
        </span>
        {icon && (
          <span className="text-ash [&>svg]:size-4" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <RollupNumber
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          className="font-mono text-[28px] font-medium leading-none text-ink"
        />
        {delta !== undefined && (
          <span
            className={cn(
              "rounded-xs px-1.5 py-0.5 font-mono text-[11px] leading-[1.4] tabular-nums",
              delta === 0
                ? "bg-surface-elevated text-mute"
                : good
                  ? "bg-positive-soft text-positive"
                  : "bg-critical-soft text-critical",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: Math.max(decimals, 1),
            })}
            {deltaSuffix}
          </span>
        )}
      </div>
      {sparkline && <div className="mt-3">{sparkline}</div>}
    </div>
  );
}
