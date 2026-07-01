"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * Reveal — the shared entrance. Fades + rises children into place immediately on
 * mount with the system's signature spring. Triggering on mount (not in-view)
 * means above-the-fold content is never left invisible waiting on an
 * IntersectionObserver — critical for readability and LCP. Reduced-motion
 * collapses it to a plain, instantly-present element.
 */
const SPRING = { type: "spring", stiffness: 220, damping: 26 } as const;

export type RevealProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Stagger offset in seconds. */
  delay?: number;
  /** Rise distance in px (default 12). */
  y?: number;
  /** Animate once vs. every entry (default once). */
  once?: boolean;
};

export function Reveal({
  children,
  className,
  style,
  delay = 0,
  y = 12,
}: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}
