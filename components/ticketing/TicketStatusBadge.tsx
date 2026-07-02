import { cn } from "@/lib/utils/cn";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

/**
 * TicketStatusBadge — maps a ticket status to the SEMANTIC token pairs
 * (soft fill + accent text): pending=warning, in-review=info,
 * approved/done=positive, declined=critical. `done` is the one terminal
 * state and reads as a filled positive chip.
 */
type Tone = "warning" | "info" | "positive" | "critical" | "positive-filled";

const TONE: Record<TicketStatus, Tone> = {
  pending: "warning",
  peeyush_review: "info",
  kamal_review: "info",
  approved: "positive",
  declined: "critical",
  done: "positive-filled",
};

const TONE_CLASS: Record<Tone, { fill: string; dot: string }> = {
  warning: { fill: "bg-warning-soft text-warning", dot: "bg-warning" },
  info: { fill: "bg-info-soft text-info", dot: "bg-info" },
  positive: { fill: "bg-positive-soft text-positive", dot: "bg-positive" },
  critical: { fill: "bg-critical-soft text-critical", dot: "bg-critical" },
  "positive-filled": { fill: "bg-positive text-on-primary", dot: "bg-on-primary" },
};

export function TicketStatusBadge({
  status,
  label,
  className,
}: {
  status: TicketStatus;
  label?: string;
  className?: string;
}) {
  const tone = TONE_CLASS[TONE[status]];
  const text = label ?? STATUS_LABELS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[12px] leading-[1.5] tracking-[0.4px]",
        tone.fill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {text}
    </span>
  );
}
