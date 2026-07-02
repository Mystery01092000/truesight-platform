"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";
import { PROVIDER_HUE } from "@/components/ui/ProviderChip";
import type { CostBreakdownSlice, CostGroupKey } from "@/app/(app)/cost/data";

/**
 * CostBreakdown — the FinOps group-by explorer. A PillTabs toggle flips one dataset
 * between four precomputed server-side groupings (Service | Account | Provider | Day);
 * no client fetch, the RSC payload already carries all four. Service/Account/Provider
 * render as stacked horizontal bars, Day as a stacked column chart — both pure SVG in
 * the Sparkline school (normalized viewBox, no chart lib). Segment hues are the
 * provider brand hues from ProviderChip so bars, chips and legend read as one system.
 * Values render in mono tabular-nums; axis labels in the micro type voice. Entrance
 * grows once per view, ≤250ms with a capped stagger, and collapses under
 * prefers-reduced-motion.
 */

const MODES: PillTabItem[] = [
  { value: "service", label: "Service" },
  { value: "account", label: "Account" },
  { value: "provider", label: "Provider" },
  { value: "day", label: "Day" },
];

const MAX_BARS = 12;
const AWS_HUE = PROVIDER_HUE.aws;
const AZURE_HUE = PROVIDER_HUE.azure;

/** Compact money formatter — exact to cents under $10k, compact above. */
function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (n >= 10_000) return `$${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type CostBreakdownProps = {
  groups: Record<CostGroupKey, CostBreakdownSlice[]>;
  awsTotal: number;
  azureTotal: number;
};

export function CostBreakdown({ groups, awsTotal, azureTotal }: CostBreakdownProps) {
  const [mode, setMode] = useState<CostGroupKey>("service");
  const slices = groups[mode];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          aria-label="Group spend by"
          value={mode}
          onChange={(v) => setMode(v as CostGroupKey)}
          items={MODES}
        />
        <Legend awsTotal={awsTotal} azureTotal={azureTotal} />
      </div>

      <div className="mt-5">
        {slices.length === 0 ? (
          <p className="py-8 text-center text-[13px] leading-[1.5] text-mute">
            No spend recorded in this window for this grouping.
          </p>
        ) : mode === "day" ? (
          <DayColumns key={mode} slices={slices} />
        ) : (
          <StackedBars key={mode} slices={slices} />
        )}
      </div>
    </div>
  );
}

function Legend({ awsTotal, azureTotal }: { awsTotal: number; azureTotal: number }) {
  return (
    <div className="flex items-center gap-4">
      <LegendItem hue={AWS_HUE} label="AWS" amount={awsTotal} />
      <LegendItem hue={AZURE_HUE} label="Azure" amount={azureTotal} />
    </div>
  );
}

function LegendItem({ hue, label, amount }: { hue: string; label: string; amount: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: hue }} aria-hidden />
      <span className="text-micro font-medium uppercase text-ash">{label}</span>
      <span className="font-mono text-micro tabular-nums text-mute">{fmt(amount)}</span>
    </span>
  );
}

/** Horizontal stacked bars — Service / Account / Provider modes. */
function StackedBars({ slices }: { slices: CostBreakdownSlice[] }) {
  const reduced = useReducedMotion();
  const top = slices.slice(0, MAX_BARS);
  const rest = slices.slice(MAX_BARS);
  const restTotal = rest.reduce((sum, s) => sum + s.total, 0);
  const max = Math.max(...top.map((s) => s.total), 0) || 1;

  return (
    <div>
      {/* Axis header — 0 → max of the visible bars */}
      <div className="grid grid-cols-[minmax(0,180px)_1fr_88px] items-center gap-3 border-b border-hairline-soft pb-1.5">
        <span className="text-micro font-medium uppercase text-ash">Group</span>
        <div className="flex items-center justify-between">
          <span className="font-mono text-micro tabular-nums text-ash">$0</span>
          <span className="font-mono text-micro tabular-nums text-ash">{fmt(max)}</span>
        </div>
        <span className="text-right text-micro font-medium uppercase text-ash">Spend</span>
      </div>

      <div className="mt-2 space-y-2">
        {top.map((s, i) => {
          const awsW = (s.aws / max) * 100;
          const azureW = (s.azure / max) * 100;
          const delay = Math.min(i, 8) * 0.025;
          return (
            <div
              key={s.key}
              className="grid grid-cols-[minmax(0,180px)_1fr_88px] items-center gap-3"
            >
              <span className="truncate text-[13px] leading-[1.5] text-body" title={s.key}>
                {s.key}
              </span>
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="h-2.5 w-full"
                role="img"
                aria-label={`${s.key}: AWS ${fmt(s.aws)}, Azure ${fmt(s.azure)}`}
              >
                <title>{`${s.key} · AWS ${fmt(s.aws)} · Azure ${fmt(s.azure)}`}</title>
                {s.aws > 0 &&
                  (reduced ? (
                    <rect x={0} y={0} width={awsW} height={10} fill={AWS_HUE} fillOpacity={0.85} />
                  ) : (
                    <motion.rect
                      x={0}
                      y={0}
                      height={10}
                      fill={AWS_HUE}
                      fillOpacity={0.85}
                      initial={{ width: 0 }}
                      animate={{ width: awsW }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay }}
                    />
                  ))}
                {s.azure > 0 &&
                  (reduced ? (
                    <rect x={awsW} y={0} width={azureW} height={10} fill={AZURE_HUE} fillOpacity={0.85} />
                  ) : (
                    <motion.rect
                      y={0}
                      height={10}
                      fill={AZURE_HUE}
                      fillOpacity={0.85}
                      initial={{ x: awsW, width: 0 }}
                      animate={{ x: awsW, width: azureW }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: delay + 0.05 }}
                    />
                  ))}
              </svg>
              <span className="text-right font-mono text-[13px] tabular-nums text-ink">
                {fmt(s.total)}
              </span>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <p className="mt-3 text-[12px] leading-[1.5] text-mute">
          + {rest.length} more group{rest.length === 1 ? "" : "s"} ·{" "}
          <span className="font-mono tabular-nums">{fmt(restTotal)}</span>
        </p>
      )}
    </div>
  );
}

/** Stacked column chart — Day mode. AWS anchors the baseline, Azure stacks above. */
function DayColumns({ slices }: { slices: CostBreakdownSlice[] }) {
  const reduced = useReducedMotion();
  const W = 720;
  const H = 160;
  const GAP = 2;
  const n = slices.length;
  const bw = Math.max(1, (W - GAP * (n - 1)) / n);
  const max = Math.max(...slices.map((s) => s.total), 0) || 1;
  const peak = slices.reduce((a, b) => (b.total > a.total ? b : a), slices[0]);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-hairline-soft pb-1.5">
        <span className="text-micro font-medium uppercase text-ash">Daily spend</span>
        <span className="font-mono text-micro tabular-nums text-ash">
          peak {fmt(peak.total)} · {peak.key}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 h-40 w-full"
        role="img"
        aria-label={`Daily spend columns from ${slices[0].key} to ${slices[n - 1].key}`}
      >
        {slices.map((s, i) => {
          const x = i * (bw + GAP);
          const awsH = (s.aws / max) * H;
          const azureH = (s.azure / max) * H;
          const delay = Math.min(i, 8) * 0.02;
          return (
            <g key={s.key}>
              <title>{`${s.key} · AWS ${fmt(s.aws)} · Azure ${fmt(s.azure)}`}</title>
              {s.aws > 0 &&
                (reduced ? (
                  <rect x={x} y={H - awsH} width={bw} height={awsH} fill={AWS_HUE} fillOpacity={0.85} />
                ) : (
                  <motion.rect
                    x={x}
                    width={bw}
                    fill={AWS_HUE}
                    fillOpacity={0.85}
                    initial={{ y: H, height: 0 }}
                    animate={{ y: H - awsH, height: awsH }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay }}
                  />
                ))}
              {s.azure > 0 &&
                (reduced ? (
                  <rect
                    x={x}
                    y={H - awsH - azureH}
                    width={bw}
                    height={azureH}
                    fill={AZURE_HUE}
                    fillOpacity={0.85}
                  />
                ) : (
                  <motion.rect
                    x={x}
                    width={bw}
                    fill={AZURE_HUE}
                    fillOpacity={0.85}
                    initial={{ y: H, height: 0 }}
                    animate={{ y: H - awsH - azureH, height: azureH }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: delay + 0.05 }}
                  />
                ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center justify-between border-t border-hairline-soft pt-1.5">
        <span className="font-mono text-micro tabular-nums text-ash">{slices[0].key}</span>
        {n > 2 && (
          <span className="font-mono text-micro tabular-nums text-ash">
            {n} day{n === 1 ? "" : "s"}
          </span>
        )}
        <span className="font-mono text-micro tabular-nums text-ash">{slices[n - 1].key}</span>
      </div>
    </div>
  );
}
