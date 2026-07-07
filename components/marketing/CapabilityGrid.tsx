"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Radar,
  Workflow,
  GitCompare,
  TrendingDown,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/*
 * CapabilityGrid — the hybrid capability showcase. All five tiles stay visible;
 * exactly one is "active" (visual at full size + a faint shimmer sweep, the one
 * sanctioned loop here). Hovering, clicking or focusing a tile activates it and
 * permanently stops auto-advance for the session; until then the active tile
 * only advances while the visitor has been idle over the section for >10s.
 * Reduced-motion: static grid, resolved visuals, no shimmer, no auto-advance.
 * Every visual resolves to a settled end state — one-shot transitions only.
 */

type VisualProps = { active: boolean };

const DOT_GLOW = Array.from({ length: 24 }, (_, i) => 0.16 + ((i * 7 + 4) % 9) * 0.08);

function DotsVisual({ active }: VisualProps) {
  return (
    <span className="grid grid-cols-6 gap-2.5">
      {DOT_GLOW.map((glow, i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-on-dark"
          initial={false}
          animate={{ opacity: active ? glow : 0.14 }}
          transition={{ duration: 0.45, delay: active ? (i % 6) * 0.05 + Math.floor(i / 6) * 0.04 : 0 }}
        />
      ))}
    </span>
  );
}

const GRAPH_NODES = [
  { x: 30, y: 40 },
  { x: 130, y: 24 },
  { x: 168, y: 96 },
  { x: 84, y: 110 },
  { x: 40, y: 96 },
];
const GRAPH_EDGES = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 2],
  [3, 4],
] as const;

function GraphVisual({ active }: VisualProps) {
  return (
    <svg viewBox="0 0 200 140" className="h-32 w-full text-on-dark">
      {GRAPH_EDGES.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={GRAPH_NODES[a].x}
          y1={GRAPH_NODES[a].y}
          x2={GRAPH_NODES[b].x}
          y2={GRAPH_NODES[b].y}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 5"
          initial={false}
          animate={{ opacity: active ? 0.4 : 0.16 }}
          transition={{ duration: 0.4, delay: active ? i * 0.07 : 0 }}
        />
      ))}
      {GRAPH_NODES.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r="9"
            fill="var(--color-surface-card)"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.9"
          />
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="2.5"
            fill="currentColor"
            initial={false}
            animate={{ opacity: active ? 1 : 0.45 }}
            transition={{ duration: 0.4, delay: active ? 0.2 + i * 0.05 : 0 }}
          />
        </g>
      ))}
    </svg>
  );
}

function DriftVisual({ active }: VisualProps) {
  return (
    <span className="flex w-full max-w-64 flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex items-center gap-2">
          <span className="h-2 w-16 rounded-full bg-hairline-strong" />
          <motion.span
            className={cn("h-2 rounded-full", row === 1 ? "bg-accent-red" : "bg-on-dark/60")}
            initial={false}
            animate={{ width: row === 1 ? (active ? 56 : 24) : 40 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: active && row === 1 ? 0.15 : 0 }}
          />
          {row === 1 && (
            <motion.span
              className="text-[12px] tracking-[0.4px] text-accent-red"
              initial={false}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: 0.3, delay: active ? 0.45 : 0 }}
            >
              drift
            </motion.span>
          )}
        </span>
      ))}
    </span>
  );
}

const COST_BARS = [58, 46, 40, 30, 22];

function CostVisual({ active }: VisualProps) {
  return (
    <span className="flex h-32 items-end gap-3 pb-2">
      {COST_BARS.map((h, i) => (
        <motion.span
          key={i}
          className="w-6 rounded-xs bg-on-dark/70"
          initial={false}
          animate={{ height: active ? h : 10 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: active ? i * 0.06 : 0 }}
        />
      ))}
    </span>
  );
}

function SecureVisual({ active }: VisualProps) {
  const reduced = useReducedMotion();
  return (
    <span className="relative grid place-items-center">
      <span className="absolute size-24 rounded-full border border-hairline-strong opacity-40" />
      {active && !reduced && (
        <motion.span
          className="absolute size-24 rounded-full border border-hairline-strong"
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      )}
      <ShieldCheck size={56} strokeWidth={1} className="relative text-on-dark" />
    </span>
  );
}

type Capability = {
  value: string;
  title: string;
  line: string;
  Icon: LucideIcon;
  Visual: React.ComponentType<VisualProps>;
};

const CAPS: Capability[] = [
  {
    value: "discover",
    title: "Every resource, discovered.",
    line: "Each account and subscription is indexed the moment it appears — ECR, ECS, S3, Postgres, VNets, and the rest.",
    Icon: Radar,
    Visual: DotsVisual,
  },
  {
    value: "visualize",
    title: "See the whole estate.",
    line: "Live, node-based maps render your infrastructure exactly as it connects — across both clouds, in one pane.",
    Icon: Workflow,
    Visual: GraphVisual,
  },
  {
    value: "drift",
    title: "Catch drift before it bites.",
    line: "Terraform state is diffed against what's actually running, so drift surfaces the instant it happens.",
    Icon: GitCompare,
    Visual: DriftVisual,
  },
  {
    value: "cost",
    title: "Spend with intent.",
    line: "Cost signals sit next to the resources that drive them — no spreadsheets, no month-end surprises.",
    Icon: TrendingDown,
    Visual: CostVisual,
  },
  {
    value: "secure",
    title: "Governed by default.",
    line: "Compliance posture, security findings, and trust boundaries stay in view across every environment.",
    Icon: ShieldCheck,
    Visual: SecureVisual,
  },
];

const IDLE_BEFORE_ADVANCE_MS = 10_000;
const ADVANCE_EVERY_MS = 4_000;

export function CapabilityGrid() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const lastInteractionRef = useRef(Date.now());
  const engagedRef = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (engagedRef.current) return;
      if (Date.now() - lastInteractionRef.current < IDLE_BEFORE_ADVANCE_MS) return;
      setActive((i) => (i + 1) % CAPS.length);
    }, ADVANCE_EVERY_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const markActivity = () => {
    lastInteractionRef.current = Date.now();
  };

  const engage = (i: number) => {
    engagedRef.current = true;
    lastInteractionRef.current = Date.now();
    setActive(i);
  };

  return (
    <div
      role="group"
      aria-label="Truesight capabilities"
      onPointerMove={markActivity}
      onPointerDown={markActivity}
      onKeyDown={markActivity}
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {CAPS.map((cap, i) => {
        const isActive = i === active;
        return (
          <button
            key={cap.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => engage(i)}
            onPointerEnter={() => engage(i)}
            onFocus={() => engage(i)}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-xl border p-6 text-left transition-colors duration-200 ease-smooth",
              isActive
                ? "border-hairline-emphasis bg-surface-elevated"
                : "border-hairline bg-surface hover:border-hairline-emphasis",
            )}
          >
            <span className="relative grid h-32 w-full place-items-center overflow-hidden rounded-md">
              <motion.span
                className="grid w-full place-items-center"
                initial={false}
                animate={{ scale: isActive ? 1 : 0.8, opacity: isActive ? 1 : 0.45 }}
                transition={{ duration: reduced ? 0 : 0.25, ease: "easeOut" }}
              >
                <cap.Visual active={reduced ? true : isActive} />
              </motion.span>
              {isActive && !reduced && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(100deg, transparent 38%, var(--color-hairline-soft) 50%, transparent 62%)",
                    backgroundSize: "220% 100%",
                    animation: "shimmer 4s ease-in-out infinite",
                  }}
                />
              )}
            </span>
            <span className="mt-5 flex items-center gap-2.5">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-sm border border-hairline transition-colors duration-200",
                  isActive ? "bg-surface-card text-on-dark" : "bg-surface text-mute",
                )}
              >
                <cap.Icon size={15} strokeWidth={1.75} />
              </span>
              <span className="text-[16px] font-medium tracking-[-0.01em] text-ink">
                {cap.title}
              </span>
            </span>
            <span className="mt-2.5 block text-[14px] leading-[1.55] text-mute">{cap.line}</span>
          </button>
        );
      })}

      {/* Curated views — teases the in-app Capability Filter; not a capability tile. */}
      <div className="flex flex-col justify-center gap-4 rounded-xl border border-hairline p-6">
        <span className="grid size-8 place-items-center rounded-sm border border-hairline bg-surface text-mute">
          <SlidersHorizontal size={15} strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="text-micro uppercase text-ash">In the app</span>
          <span className="text-[16px] font-medium tracking-[-0.01em] text-ink">
            Curated views
          </span>
          <p className="text-[14px] leading-[1.55] text-mute">
            Curate what each audience sees — toggle capabilities per session.
          </p>
        </div>
      </div>
    </div>
  );
}
