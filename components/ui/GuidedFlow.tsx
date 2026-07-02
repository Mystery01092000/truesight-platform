"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

/**
 * GuidedFlow — a step-based guided workflow shell (the Digio "guided governance"
 * pattern). Each step carries a label, status (pending/active/done/skipped),
 * and arbitrary content. The stepper renders as a compact horizontal rail with
 * the active step expanded. Navigation is explicit (Back / Next) so human
 * interaction stays in the loop.
 *
 * Use this for compliance workflows, ticket approval journeys, drift
 * reconciliation, and any multi-step operational task where traceability
 * matters.
 */
export type StepStatus = "pending" | "active" | "done" | "skipped";

export type GuidedStep = {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
};

export type GuidedFlowProps = {
  steps: GuidedStep[];
  /** The index of the currently-active step. */
  activeIndex: number;
  /** Fired when the user presses Next. */
  onNext?: () => void;
  /** Fired when the user presses Back. */
  onBack?: () => void;
  /** Disable the Next button (e.g. until a required action completes). */
  nextDisabled?: boolean;
  /** Override the Next button label. */
  nextLabel?: string;
  /** Hide navigation buttons (for read-only display). */
  readOnly?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const STATUS_DOT: Record<StepStatus, string> = {
  pending: "bg-stone",
  active: "bg-iris",
  done: "bg-accent-green",
  skipped: "bg-mute",
};

export function GuidedFlow({
  steps,
  activeIndex,
  onNext,
  onBack,
  nextDisabled,
  nextLabel,
  readOnly,
  className,
  children,
}: GuidedFlowProps) {
  const reduced = useReducedMotion();

  return (
    <Surface level={1} radius="lg" className={cn("p-5", className)}>
      {/* Stepper rail */}
      <div className="flex items-center gap-1 overflow-x-auto pb-4">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border transition-colors",
                  step.status === "active"
                    ? "border-iris/50 bg-iris-soft"
                    : "border-hairline bg-surface-card",
                )}
              >
                {step.status === "done" ? (
                  <Check size={13} strokeWidth={2.5} className="text-accent-green" />
                ) : (
                  <span className={cn("size-2 rounded-full", STATUS_DOT[step.status])} />
                )}
              </span>
              <span
                className={cn(
                  "text-[12px] font-medium leading-none whitespace-nowrap transition-colors",
                  step.status === "active" ? "text-on-dark" : "text-mute",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <ChevronRight size={14} className="mx-0.5 text-stone" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Active step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {!readOnly ? (
        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
          <Button
            variant="tertiary"
            size="sm"
            onClick={onBack}
            disabled={activeIndex === 0}
          >
            Back
          </Button>
          <span className="font-mono text-[12px] tabular-nums text-mute">
            {activeIndex + 1} / {steps.length}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={onNext}
            disabled={nextDisabled || activeIndex === steps.length - 1}
          >
            {nextLabel ?? "Next"}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
