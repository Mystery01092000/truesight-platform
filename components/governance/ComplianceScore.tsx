"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { RollupNumber } from "@/components/ui/RollupNumber";

/**
 * ComplianceScore — a circular posture gauge. The arc fills from 0 to the
 * score percentage with a spring on mount; the number rolls up in the centre.
 * Monochrome track (surface-elevated), iris arc fill — the one place the brand
 * accent earns its keep as a progress signal.
 */

const SIZE = 128;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

export function ComplianceScore({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const target = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--color-iris)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          initial={reduced ? false : { strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: target }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 55, damping: 16, mass: 0.9 }
          }
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-[26px] font-medium leading-none tabular-nums text-ink">
          <RollupNumber value={clamped} suffix="%" duration={900} />
        </span>
        <span className="mt-1 text-[11px] tracking-[0.3px] text-mute">posture</span>
      </div>
    </div>
  );
}
