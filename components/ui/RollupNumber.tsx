"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * RollupNumber — the count-up primitive. Animates from the previous value to
 * the next using the system's signature spring. Renders in tabular-nums so the
 * column holds its width as live estate numbers refresh in place.
 * Reduced-motion collapses to the final value instantly.
 *
 * This replaces every static stat number on overview/cost/security so the
 * "living system" reads at a glance — the single highest-visibility motion fix.
 */
export type RollupNumberProps = {
  value: number;
  /** Animation duration in ms (default 700). */
  duration?: number;
  /** Number of decimal places (default 0). */
  decimals?: number;
  /** Prefix (e.g. "$", "€"). */
  prefix?: string;
  /** Suffix (e.g. "%", "k"). */
  suffix?: string;
  /** Locale for formatting (default "en-US"). */
  locale?: string;
  className?: string;
};

export function RollupNumber({
  value,
  duration = 700,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "en-US",
  className,
}: RollupNumberProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }

    const from = prev.current;
    const to = value;
    if (from === to) return;

    const controls = animate(from, to, {
      duration: duration / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });

    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduced]);

  const formatted = display.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
