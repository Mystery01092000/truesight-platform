"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Radar,
  Workflow,
  GitCompare,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonClass } from "@/components/ui/Button";
import { Keycap } from "@/components/ui/Keycap";
import { PillTabs } from "@/components/ui/PillTabs";
import { Reveal } from "@/components/ui/Reveal";
import { Surface } from "@/components/ui/Surface";

/* ────────────────────────────────────────────────────────────────────────── *
 * Hero aperture — the Argus "watching / scanning" motif. Concentric hairline
 * rings + radial blades that rotate, a monochrome scan sweep, pulse rings out
 * of the pupil. All decoration is monochrome; accent lives only in icon tiles.
 * ────────────────────────────────────────────────────────────────────────── */
function Aperture() {
  const reduced = useReducedMotion();
  // Round to 3dp so SSR and client emit identical coordinate strings (raw
  // Math.cos/sin floats differ in the last digit → hydration mismatch).
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const blades = Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI / 6) * i;
    const rO = 78;
    const rI = 54;
    return {
      x1: r(100 + rO * Math.cos(a)),
      y1: r(100 + rO * Math.sin(a)),
      x2: r(100 + rI * Math.cos(a)),
      y2: r(100 + rI * Math.sin(a)),
    };
  });

  return (
    <div className="relative grid aspect-square w-full max-w-[340px] place-items-center">
      {/* pulse rings emanating from the pupil */}
      <span className="absolute size-40 rounded-full border border-hairline-strong animate-pulse-ring" />
      <span
        className="absolute size-40 rounded-full border border-hairline animate-pulse-ring"
        style={{ animationDelay: "1s" }}
      />

      <svg viewBox="0 0 200 200" fill="none" className="relative size-full text-ink">
        {/* static concentric iris rings */}
        <circle cx="100" cy="100" r="92" stroke="currentColor" strokeWidth="1" opacity="0.14" />
        <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="1" opacity="0.28" />
        <circle cx="100" cy="100" r="52" stroke="currentColor" strokeWidth="1" opacity="0.45" />

        {/* rotating aperture: dashed ring + converging blades */}
        <motion.g
          style={{ transformOrigin: "100px 100px" }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="100"
            cy="100"
            r="88"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 9"
            opacity="0.4"
            className="animate-flow"
          />
          {blades.map((b, i) => (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.4"
            />
          ))}
        </motion.g>

        {/* pupil */}
        <circle cx="100" cy="100" r="8" fill="currentColor" />
      </svg>

      {/* monochrome scan sweep, clipped to the iris */}
      <div className="pointer-events-none absolute size-[184px] overflow-hidden rounded-full">
        <div className="absolute inset-x-0 h-20 animate-scan bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.07),transparent)]" />
      </div>

      {/* watching pulse over the pupil */}
      <span
        className="absolute size-3 rounded-full border border-on-dark animate-pulse-ring"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Capability showcase — auto-cycling every ~4s. One short title + one line +
 * one simple motion visual per tab.
 * ────────────────────────────────────────────────────────────────────────── */
type Capability = {
  value: string;
  label: string;
  title: string;
  line: string;
  Icon: LucideIcon;
  visual: React.ReactNode;
};

function DotsVisual() {
  return (
    <div className="grid grid-cols-6 gap-2.5">
      {Array.from({ length: 24 }, (_, i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-on-dark"
          initial={{ opacity: 0.12 }}
          animate={{ opacity: [0.12, 0.85, 0.12] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: (i % 6) * 0.12 + Math.floor(i / 6) * 0.1 }}
        />
      ))}
    </div>
  );
}

function GraphVisual() {
  const nodes = [
    { x: 30, y: 40 },
    { x: 130, y: 24 },
    { x: 168, y: 96 },
    { x: 84, y: 110 },
    { x: 40, y: 96 },
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 2],
    [3, 4],
  ];
  return (
    <svg viewBox="0 0 200 140" className="h-32 w-full text-on-dark">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 5"
          opacity="0.35"
          className="animate-flow"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="9" fill="var(--color-surface-card)" stroke="currentColor" strokeWidth="1" opacity="0.9" />
          <circle cx={n.x} cy={n.y} r="2.5" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function DriftVisual() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-2">
          <span className="h-2 w-16 rounded-full bg-hairline-strong" />
          <motion.span
            className={cn("h-2 rounded-full", row === 1 ? "bg-accent-red" : "bg-on-dark/60")}
            initial={{ width: row === 1 ? 24 : 40 }}
            animate={{ width: row === 1 ? [24, 56, 24] : 40 }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          {row === 1 && <span className="text-[12px] tracking-[0.4px] text-accent-red">drift</span>}
        </div>
      ))}
    </div>
  );
}

function CostVisual() {
  const bars = [58, 46, 40, 30, 22];
  return (
    <div className="flex h-32 items-end gap-3">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-6 rounded-xs bg-on-dark/70"
          initial={{ height: 8 }}
          animate={{ height: h }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: i * 0.08 }}
        />
      ))}
    </div>
  );
}

function SecureVisual() {
  return (
    <div className="relative grid place-items-center">
      <span className="absolute size-24 rounded-full border border-hairline-strong animate-pulse-ring" />
      <ShieldCheck size={64} strokeWidth={1} className="relative text-on-dark" />
    </div>
  );
}

const CAPS: Capability[] = [
  {
    value: "discover",
    label: "Discover",
    title: "Every resource, discovered.",
    line: "Argus indexes each account and subscription the moment it appears — ECR, ECS, S3, Postgres, VNets, and the rest.",
    Icon: Radar,
    visual: <DotsVisual />,
  },
  {
    value: "visualize",
    label: "Visualize",
    title: "See the whole estate.",
    line: "Live, node-based maps render your infrastructure exactly as it connects — across both clouds, in one pane.",
    Icon: Workflow,
    visual: <GraphVisual />,
  },
  {
    value: "drift",
    label: "Detect drift",
    title: "Catch drift before it bites.",
    line: "Terraform state is diffed against what's actually running, so configuration drift surfaces the instant it happens.",
    Icon: GitCompare,
    visual: <DriftVisual />,
  },
  {
    value: "cost",
    label: "Optimize cost",
    title: "Spend with intent.",
    line: "Cost signals sit next to the resources that drive them — no spreadsheets, no month-end surprises.",
    Icon: TrendingDown,
    visual: <CostVisual />,
  },
  {
    value: "secure",
    label: "Secure",
    title: "Governed by default.",
    line: "Compliance posture, security findings, and trust boundaries stay in view across every environment.",
    Icon: ShieldCheck,
    visual: <SecureVisual />,
  },
];

function Showcase() {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(CAPS[0].value);
  const index = CAPS.findIndex((c) => c.value === value);
  const cap = CAPS[index] ?? CAPS[0];

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      setValue(CAPS[(index + 1) % CAPS.length].value);
    }, 4000);
    return () => clearTimeout(t);
  }, [index, reduced]);

  return (
    <div className="flex flex-col items-center gap-8">
      <PillTabs
        value={value}
        onChange={setValue}
        aria-label="Argus capabilities"
        items={CAPS.map((c) => ({ value: c.value, label: c.label }))}
      />

      <Surface level={1} radius="xl" className="w-full overflow-hidden">
        <div className="grid items-center gap-8 p-8 md:grid-cols-2 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${cap.value}-copy`}
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -10 }}
              transition={{ duration: reduced ? 0 : 0.35 }}
              className="flex flex-col gap-4"
            >
              <span className="grid size-11 place-items-center rounded-md border border-hairline bg-surface-card text-on-dark">
                <cap.Icon size={20} strokeWidth={1.75} />
              </span>
              <h3 className="text-[24px] font-medium leading-[1.2] tracking-[0.2px] text-ink">
                {cap.title}
              </h3>
              <p className="max-w-md text-[16px] leading-[1.6] text-body">{cap.line}</p>
            </motion.div>
          </AnimatePresence>

          <div className="grid min-h-40 place-items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${cap.value}-visual`}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
                transition={{ duration: reduced ? 0 : 0.35 }}
                className="grid w-full place-items-center"
              >
                {cap.visual}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Surface>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col items-start gap-6">
          <Reveal>
            <h1 className="max-w-xl text-[44px] font-semibold leading-[1.08] tracking-[0.2px] text-ink md:text-[56px]">
              Cloud governance with no blind spots.
            </h1>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="max-w-lg text-[18px] leading-[1.6] text-body">
              Argus watches every account, subscription, and Terraform state across AWS and
              Azure — one visual, self-discovering pane that never looks away.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="flex flex-col gap-3">
              <Link href="/login" className={buttonClass("primary", "md")}>
                Enter Argus
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-mute">
                Search your estate with <Keycap>⌘</Keycap> <Keycap>K</Keycap>
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="flex justify-center md:justify-end">
          <Aperture />
        </Reveal>
      </section>

      {/* Capability showcase */}
      <section className="mx-auto w-full max-w-[1240px] px-6 py-16 md:py-24">
        <Reveal className="mb-12 flex max-w-xl flex-col gap-3">
          <h2 className="text-[36px] font-medium leading-[1.15] tracking-[0.2px] text-ink">
            One watcher. Five ways it sees.
          </h2>
          <p className="text-[18px] leading-[1.6] text-body">
            From discovery to drift, cost to compliance — every angle of your estate, always in
            focus.
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <Showcase />
        </Reveal>
      </section>

      {/* Closing band */}
      <section className="mx-auto w-full max-w-[1240px] px-6 py-20 md:py-28">
        <Reveal>
          <Surface level={1} radius="xl" className="flex flex-col items-center gap-6 px-6 py-16 text-center">
            <h2 className="max-w-2xl text-[36px] font-medium leading-[1.15] tracking-[0.2px] text-ink md:text-[44px]">
              One pane across your entire DevOps lifecycle.
            </h2>
            <p className="max-w-xl text-[18px] leading-[1.6] text-body">
              GitHub, AWS, Azure, and Terraform — discovered, visualized, and governed from a
              single surface. Stateless by design, live by default.
            </p>
            <Link href="/login" className={buttonClass("primary", "md")}>
              Enter Argus
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </Surface>
        </Reveal>
      </section>
    </div>
  );
}
