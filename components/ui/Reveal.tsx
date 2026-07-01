"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * Reveal — the shared entrance. Fades + rises children into place on in-view
 * with the system's signature spring (stiffness 120, damping 18). Motion
 * carries meaning here, so it's honored — but reduced-motion collapses it to a
 * plain, instantly-present element.
 */
const SPRING = { type: "spring", stiffness: 120, damping: 18 } as const;

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
  once = true,
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
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-64px" }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}
