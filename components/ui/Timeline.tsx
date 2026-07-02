"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * Timeline — the shared vertical rail. `status` is the ticket-history shape
 * (small dot markers on a hairline rail); `chat` is the conversational shape
 * (left avatar/glyph tile, title row with timestamp, body slot, same rail).
 * Motion: one 250ms entrance per item, ≤40ms stagger, mount-once. Reduced
 * motion renders instantly.
 */
export type TimelineItem = {
  id: string | number;
  /** Rail marker override: a status dot glyph or a chat avatar/initial. */
  marker?: React.ReactNode;
  /** Title row content (badge, actor, event name). */
  title: React.ReactNode;
  timestamp?: React.ReactNode;
  /** Body slot rendered under the title row. */
  body?: React.ReactNode;
};

export type TimelineVariant = "status" | "chat";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Timeline({
  items,
  variant = "status",
  emptyMessage = "Nothing recorded yet.",
  className,
}: {
  items: TimelineItem[];
  variant?: TimelineVariant;
  emptyMessage?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const chat = variant === "chat";

  if (items.length === 0) {
    return <p className="text-[14px] leading-[1.6] text-mute">{emptyMessage}</p>;
  }

  return (
    <ol className={cn("relative", chat ? "space-y-6 pl-10" : "space-y-5 pl-5", className)}>
      {/* Connecting rail — runs behind the markers. */}
      <span
        className={cn(
          "absolute top-1.5 bottom-1.5 w-px bg-hairline",
          chat ? "left-[13px]" : "left-[5px]",
        )}
        aria-hidden
      />
      {items.map((item, i) => {
        const marker = chat ? (
          <span
            className="absolute -left-10 top-0 flex size-7 items-center justify-center rounded-full border border-hairline bg-surface-elevated text-[11px] font-medium text-mute [&>svg]:size-3.5"
            aria-hidden
          >
            {item.marker}
          </span>
        ) : (
          <span className="absolute -left-5 top-1.5" aria-hidden>
            {item.marker ?? (
              <span className="block size-2.5 rounded-full border-2 border-surface bg-hairline-strong" />
            )}
          </span>
        );

        const body = (
          <>
            {marker}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px] leading-[1.5] text-body">
                {item.title}
              </div>
              {item.timestamp && (
                <span className="font-mono text-[11px] tabular-nums text-stone">
                  {item.timestamp}
                </span>
              )}
            </div>
            {item.body && (
              <div className="mt-1 text-[13px] leading-[1.5] text-mute">{item.body}</div>
            )}
          </>
        );

        if (reduced) {
          return (
            <li key={item.id} className="relative">
              {body}
            </li>
          );
        }

        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE, delay: Math.min(i * 0.04, 0.32) }}
            className="relative"
          >
            {body}
          </motion.li>
        );
      })}
    </ol>
  );
}
