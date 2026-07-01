"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * PillTabs — segmented filter chips. Rounded-full, transparent by default; the
 * active chip "lifts" one surface notch to surface-elevated. The lift is a
 * shared-layout highlight that slides between chips (layoutId) for continuity.
 */
export type PillTabItem = { value: string; label: React.ReactNode };

export type PillTabsProps = {
  value: string;
  onChange: (value: string) => void;
  items: PillTabItem[];
  className?: string;
  "aria-label"?: string;
};

export function PillTabs({
  value,
  onChange,
  items,
  className,
  "aria-label": ariaLabel,
}: PillTabsProps) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative rounded-full px-2.5 py-1 text-[14px] leading-[1.6] transition-colors",
              active ? "text-on-dark" : "text-body hover:text-on-dark",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className="absolute inset-0 -z-0 rounded-full bg-surface-elevated"
                aria-hidden
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
