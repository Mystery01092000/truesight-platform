"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/*
 * SectionReveal — the marketing page's one sanctioned scroll entrance. Each
 * below-the-fold section fades up once (≤300ms) as it enters the viewport;
 * nothing replays on re-entry. Reduced-motion renders a plain, instantly
 * present element. Hero content keeps the mount-triggered `Reveal` instead,
 * so above-the-fold copy never waits on an IntersectionObserver.
 */
export function SectionReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
