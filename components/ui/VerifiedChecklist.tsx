"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, X, AlertTriangle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/taxonomy";

/**
 * VerifiedChecklist — a governance checklist where each control's state is
 * backed by REAL data (drift findings, vulnerability scans, compliance rules),
 * not a manual toggle. The Digio "centralized verified checklist" pattern:
 * every ✓/✗ across the estate traces to an actual finding.
 *
 * Pass `verified: "pass" | "fail" | "warn" | "unknown"` per item. The component
 * resolves the glyph + tone from the canonical taxonomy accents.
 */
export type VerifiedState = "pass" | "fail" | "warn" | "unknown";

export type ChecklistEntry = {
  id: string;
  label: string;
  description?: string;
  verified: VerifiedState;
  severity?: Severity;
  /** Optional count of underlying findings (e.g. "3 violations"). */
  count?: number;
};

export type VerifiedChecklistProps = {
  title?: string;
  entries: ChecklistEntry[];
  className?: string;
};

const STATE_ICON: Record<VerifiedState, typeof Check> = {
  pass: Check,
  fail: X,
  warn: AlertTriangle,
  unknown: CircleDot,
};

const STATE_TONE: Record<VerifiedState, { icon: string; bg: string; ring: string }> = {
  pass: { icon: "text-accent-green", bg: "bg-accent-green-soft", ring: "ring-accent-green/30" },
  fail: { icon: "text-accent-red", bg: "bg-accent-red-soft", ring: "ring-accent-red/30" },
  warn: { icon: "text-accent-yellow", bg: "bg-accent-yellow-soft", ring: "ring-accent-yellow/30" },
  unknown: { icon: "text-mute", bg: "bg-surface-elevated", ring: "ring-hairline" },
};

export function VerifiedChecklist({
  title,
  entries,
  className,
}: VerifiedChecklistProps) {
  const reduced = useReducedMotion();
  const passCount = entries.filter((e) => e.verified === "pass").length;

  return (
    <div className={className}>
      {title ? (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-medium text-ink">{title}</h3>
          <span className="font-mono text-[12px] tabular-nums text-mute">
            {passCount}/{entries.length} verified
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        {entries.map((entry, i) => {
          const Icon = STATE_ICON[entry.verified];
          const tone = STATE_TONE[entry.verified];
          return (
            <motion.div
              key={entry.id}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { delay: i * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex items-start gap-3 rounded-md border border-hairline bg-surface px-3 py-2.5",
                "transition-colors hover:bg-surface-elevated",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1",
                  tone.bg,
                  tone.ring,
                )}
              >
                <Icon size={12} strokeWidth={2.5} className={tone.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-[1.4] text-ink">
                  {entry.label}
                </div>
                {entry.description ? (
                  <div className="mt-0.5 text-[12px] leading-[1.5] text-mute">
                    {entry.description}
                  </div>
                ) : null}
              </div>
              {entry.count !== undefined && entry.count > 0 ? (
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-mute">
                  {entry.count}
                </span>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
