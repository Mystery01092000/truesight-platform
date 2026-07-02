"use client";

import { motion, useReducedMotion } from "motion/react";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export type TimelineEntry = {
  fromStatus: string | null;
  toStatus: string;
  actor: string | null;
  at: string | Date;
};

const SPRING = { type: "spring", stiffness: 220, damping: 26 } as const;

function entryText(entry: TimelineEntry): string {
  const to = STATUS_LABELS[entry.toStatus as TicketStatus] ?? entry.toStatus;
  if (!entry.fromStatus) return `Ticket opened at ${to}.`;
  const from = STATUS_LABELS[entry.fromStatus as TicketStatus] ?? entry.fromStatus;
  return `Moved from ${from} to ${to}.`;
}

/**
 * StatusTimeline — vertical timeline of a ticket's status transitions, newest
 * first. Each entry shows the resulting status badge, the actor, and a
 * timestamp. Entrance uses the system's signature spring.
 */
export function StatusTimeline({ entries }: { entries: TimelineEntry[] }) {
  const reduced = useReducedMotion();

  if (entries.length === 0) {
    return (
      <p className="text-[14px] leading-[1.6] text-mute">No status transitions recorded yet.</p>
    );
  }

  return (
    <ol className="relative space-y-5 pl-5">
      <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-hairline" aria-hidden />
      {entries.map((entry, i) => {
        const at = typeof entry.at === "string" ? new Date(entry.at) : entry.at;
        const marker = (
          <span
            className="absolute -left-5 top-1.5 size-2.5 rounded-full border-2 border-surface bg-hairline-strong"
            aria-hidden
          />
        );
        const body = (
          <>
            {marker}
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={entry.toStatus as TicketStatus} />
              <span className="font-mono text-[12px] text-ash">
                {entry.actor ? `by ${entry.actor}` : "system"}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-[1.5] text-mute">{entryText(entry)}</p>
            <time className="mt-0.5 block text-[12px] text-stone">{at.toLocaleString()}</time>
          </>
        );

        if (reduced) {
          return (
            <li key={i} className="relative">
              {body}
            </li>
          );
        }

        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.04 }}
            className="relative"
          >
            {body}
          </motion.li>
        );
      })}
    </ol>
  );
}
