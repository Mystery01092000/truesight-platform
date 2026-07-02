"use client";

import { RollupNumber } from "@/components/ui/RollupNumber";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/taxonomy";

/**
 * VulnCounter — a compact severity counter tile, dressed exactly like StatTile
 * (same padding, label treatment and mono figure) so the posture row and the
 * KPI row read as one system. The dot tint uses the semantic status tokens
 * (critical/warning/info) so it stays consistent with StatusBadge without
 * re-declaring the taxonomy.
 */
export type VulnCounterProps = {
  severity: Severity;
  count: number;
  className?: string;
};

const DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-critical",
  medium: "bg-warning",
  low: "bg-mute",
  info: "bg-info",
};

const LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function VulnCounter({ severity, count, className }: VulnCounterProps) {
  return (
    <div className={cn("rounded-lg border border-hairline bg-surface p-4", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", DOT[severity])} aria-hidden />
        <span className="text-[13px] font-medium leading-[1.5] tracking-[0.015em] text-mute">
          {LABEL[severity]}
        </span>
      </div>
      <div className="mt-2">
        <RollupNumber
          value={count}
          className="font-mono text-[28px] font-medium leading-none text-ink"
        />
      </div>
    </div>
  );
}
