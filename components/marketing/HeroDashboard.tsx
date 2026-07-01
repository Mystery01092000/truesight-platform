"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/* ────────────────────────────────────────────────────────────────────────── *
 * HeroDashboard — the landing hero centerpiece: a living preview of the Argus
 * estate overview. Window chrome + a "live" scan sweep, four estate metrics, a
 * cross-cloud topology sketch, and the per-provider breakdown. Monochrome with
 * restrained status accents; every number mirrors the real synced estate so the
 * preview reads as the product, not a mockup.
 * ────────────────────────────────────────────────────────────────────────── */

type Metric = {
  label: string;
  value: string;
  hint: string;
  tone?: "ink" | "green" | "red" | "blue";
};

const METRICS: Metric[] = [
  { label: "Resources", value: "3,084", hint: "across both clouds", tone: "ink" },
  { label: "Accounts · subs", value: "6", hint: "AWS + Azure", tone: "blue" },
  { label: "Drift", value: "3", hint: "vs Terraform state", tone: "red" },
  { label: "Compliance", value: "98%", hint: "posture in focus", tone: "green" },
];

const TONE_DOT: Record<NonNullable<Metric["tone"]>, string> = {
  ink: "bg-on-dark",
  green: "bg-accent-green",
  red: "bg-accent-red",
  blue: "bg-accent-blue",
};

const PROVIDERS = [
  { name: "AWS", count: "2,557", dot: "bg-accent-yellow" },
  { name: "Azure", count: "281", dot: "bg-accent-blue" },
  { name: "GitHub", count: "246", dot: "bg-on-dark" },
];

/* Cross-cloud topology sketch — fixed integer coordinates so SSR and client
   emit identical markup (no hydration drift). Node tone hints the provider. */
const NODES = [
  { x: 34, y: 34, tone: "text-accent-yellow" },
  { x: 118, y: 22, tone: "text-accent-blue" },
  { x: 176, y: 58, tone: "text-on-dark" },
  { x: 150, y: 116, tone: "text-accent-yellow" },
  { x: 74, y: 104, tone: "text-accent-blue" },
  { x: 30, y: 78, tone: "text-on-dark" },
];
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [1, 4],
];

export function HeroDashboard() {
  const reduced = useReducedMotion();

  return (
    <PanelFrame>
      <div className="relative w-full overflow-hidden rounded-xl border border-hairline-strong bg-surface-card">
        {/* live scan sweep */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-x-0 h-24 animate-scan bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.05),transparent)]" />
          </div>
        )}

        {/* window chrome */}
        <div className="relative z-10 flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative grid place-items-center">
              <span className="absolute size-3 rounded-full border border-iris/50 animate-pulse-ring" />
              <span className="size-1.5 rounded-full bg-iris" />
            </span>
            <span className="text-[13px] font-medium tracking-[0.2px] text-ink">
              Estate overview
            </span>
            <span className="text-[12px] tracking-[0.3px] text-mute">· Live</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full border border-hairline-strong" />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-5 p-5">
          {/* metric tiles */}
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * i }}
                className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-3.5"
              >
                <span className="flex items-center gap-1.5 text-[12px] tracking-[0.2px] text-mute">
                  <span className={cn("size-1.5 rounded-full", TONE_DOT[m.tone ?? "ink"])} />
                  {m.label}
                </span>
                <span className="text-[26px] font-semibold leading-none tracking-[0.2px] text-ink">
                  {m.value}
                </span>
                <span className="text-[11px] tracking-[0.2px] text-stone">{m.hint}</span>
              </motion.div>
            ))}
          </div>

          {/* cross-cloud topology + provider breakdown */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="rounded-lg border border-hairline bg-surface p-3">
              <span className="text-[11px] uppercase tracking-[1px] text-stone">Topology</span>
              <svg viewBox="0 0 206 138" className="mt-1 h-[104px] w-full">
                {EDGES.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={NODES[a].x}
                    y1={NODES[a].y}
                    x2={NODES[b].x}
                    y2={NODES[b].y}
                    stroke="currentColor"
                    className="text-on-dark animate-flow"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                    opacity="0.3"
                  />
                ))}
                {NODES.map((n, i) => (
                  <g key={i} className={n.tone}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r="8"
                      fill="var(--color-surface-card)"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      opacity="0.9"
                    />
                    <circle cx={n.x} cy={n.y} r="2.5" fill="currentColor" />
                  </g>
                ))}
              </svg>
            </div>

            <div className="flex flex-col justify-center gap-2.5 rounded-lg border border-hairline bg-surface p-3.5">
              {PROVIDERS.map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-body">
                    <span className={cn("size-2 rounded-full", p.dot)} />
                    {p.name}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-ink">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
}

/* Soft ambient frame around the panel — a hairline mat that lifts the dashboard
   off the canvas without a drop shadow (the design system uses edges, not
   shadows, for elevation). */
function PanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[520px] rounded-[20px] border border-hairline bg-canvas/40 p-2">
      {children}
    </div>
  );
}
