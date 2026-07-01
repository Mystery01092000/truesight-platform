"use client";

import { motion, useReducedMotion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";

/* ────────────────────────────────────────────────────────────────────────── *
 * HeroDashboard — the landing hero centerpiece: a living preview of the Argus
 * estate overview. Window chrome + a "live" scan sweep, four estate metrics, a
 * cross-cloud topology sketch, and the per-provider breakdown. Every number is
 * fetched from the public `/api/landing-stats` endpoint (real synced estate,
 * short-TTL cached) — so the "· Live" label is honest. While it loads the tiles
 * show quiet skeletons; if the fetch fails they degrade to a neutral em-dash and
 * the "· Live" label is dropped. Never a fabricated figure.
 * ────────────────────────────────────────────────────────────────────────── */

type LandingStats = {
  resources: number;
  accounts: number;
  drift: number;
  coverage: number;
  providers: { aws: number; azure: number; github: number };
  updatedAt: string;
};

async function fetchLandingStats(): Promise<LandingStats> {
  const res = await fetch("/api/landing-stats", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`landing-stats ${res.status}`);
  return (await res.json()) as LandingStats;
}

const NUMBER_FMT = new Intl.NumberFormat("en-US");
const fmt = (n: number) => NUMBER_FMT.format(n);

type Tone = "ink" | "green" | "red" | "blue";

const TONE_DOT: Record<Tone, string> = {
  ink: "bg-on-dark",
  green: "bg-accent-green",
  red: "bg-accent-red",
  blue: "bg-accent-blue",
};

/* Cross-cloud topology sketch — fixed integer coordinates so SSR and client
   emit identical markup (no hydration drift). Decorative, not data-bearing. */
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
  const { data, isError } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: fetchLandingStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  // The fetch has resolved with data → real numbers; the "· Live" badge is earned.
  const live = !!data;
  // Fetch settled unsuccessfully with nothing to show → neutral, honest fallback.
  const failed = isError && !data;

  const metrics: { label: string; hint: string; tone: Tone; value: string | null }[] = [
    { label: "Resources", hint: "across both clouds", tone: "ink", value: data ? fmt(data.resources) : null },
    { label: "Accounts · subs", hint: "AWS + Azure", tone: "blue", value: data ? fmt(data.accounts) : null },
    { label: "Drift", hint: "vs Terraform state", tone: "red", value: data ? fmt(data.drift) : null },
    { label: "Coverage", hint: "resources present", tone: "green", value: data ? `${data.coverage}%` : null },
  ];

  const providers: { name: string; dot: string; count: string | null }[] = [
    { name: "AWS", dot: "bg-accent-yellow", count: data ? fmt(data.providers.aws) : null },
    { name: "Azure", dot: "bg-accent-blue", count: data ? fmt(data.providers.azure) : null },
    { name: "GitHub", dot: "bg-on-dark", count: data ? fmt(data.providers.github) : null },
  ];

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
            {live && (
              <span className="text-[12px] tracking-[0.3px] text-mute">· Live</span>
            )}
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
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * i }}
                className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-3.5"
              >
                <span className="flex items-center gap-1.5 text-[12px] tracking-[0.2px] text-mute">
                  <span className={cn("size-1.5 rounded-full", TONE_DOT[m.tone])} />
                  {m.label}
                </span>
                <MetricValue value={m.value} failed={failed} />
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
              {providers.map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-body">
                    <span className={cn("size-2 rounded-full", p.dot)} />
                    {p.name}
                  </span>
                  <ProviderCount value={p.count} failed={failed} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
}

/* Metric value — real number once loaded, a quiet skeleton while fetching, and a
   neutral em-dash (never a fake figure) if the endpoint is unavailable. */
function MetricValue({ value, failed }: { value: string | null; failed: boolean }) {
  if (value !== null) {
    return (
      <span className="text-[26px] font-semibold leading-none tracking-[0.2px] text-ink">
        {value}
      </span>
    );
  }
  if (failed) {
    return (
      <span className="text-[26px] font-semibold leading-none tracking-[0.2px] text-stone">—</span>
    );
  }
  return (
    <span
      className="h-[26px] w-14 animate-pulse rounded bg-hairline-strong/40"
      aria-hidden
      role="presentation"
    />
  );
}

/* Provider tally — same real/loading/failed treatment, in the mono metric voice. */
function ProviderCount({ value, failed }: { value: string | null; failed: boolean }) {
  if (value !== null) {
    return <span className="font-mono text-[13px] tabular-nums text-ink">{value}</span>;
  }
  if (failed) {
    return <span className="font-mono text-[13px] tabular-nums text-stone">—</span>;
  }
  return (
    <span
      className="h-3.5 w-8 animate-pulse rounded bg-hairline-strong/40"
      aria-hidden
      role="presentation"
    />
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
