"use client";

import { RollupNumber } from "@/components/ui/RollupNumber";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/taxonomy";

/**
 * VulnCounter — a compact severity counter card. The dot tint follows the system's
 * severity→tone mapping (critical/high red, medium yellow, low mute, info blue) so it
 * reads consistently with StatusBadge without re-declaring the taxonomy.
 */
export type VulnCounterProps = {
  severity: Severity;
  count: number;
  className?: string;
};

const DOT: Record<Severity, string> = {
  critical: "bg-accent-red",
  high: "bg-accent-red",
  medium: "bg-accent-yellow",
  low: "bg-mute",
  info: "bg-accent-blue",
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
    <Surface level={1} radius="lg" className={cn("p-5", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", DOT[severity])} aria-hidden />
        <span className="text-[13px] text-mute">{LABEL[severity]}</span>
      </div>
      <div className="mt-3 font-display text-[40px] font-medium leading-none tracking-[-0.5px] text-ink">
        <RollupNumber value={count} />
      </div>
    </Surface>
  );
}
