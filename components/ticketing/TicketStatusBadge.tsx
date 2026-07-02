import { cn } from "@/lib/utils/cn";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

/**
 * TicketStatusBadge — maps a ticket status to the accent-soft fill + accent text
 * pair, consistent with the design system's StatusBadge vocabulary.
 */
type Tone = "mute" | "blue" | "green" | "red" | "filled-green";

const TONE: Record<TicketStatus, Tone> = {
  pending: "mute",
  peeyush_review: "blue",
  kamal_review: "blue",
  approved: "green",
  declined: "red",
  done: "filled-green",
};

const TONE_CLASS: Record<Tone, { fill: string; dot: string }> = {
  mute: { fill: "bg-surface-elevated text-mute", dot: "bg-mute" },
  blue: { fill: "bg-accent-blue-soft text-accent-blue", dot: "bg-accent-blue" },
  green: { fill: "bg-accent-green-soft text-accent-green", dot: "bg-accent-green" },
  red: { fill: "bg-accent-red-soft text-accent-red", dot: "bg-accent-red" },
  "filled-green": { fill: "bg-accent-green text-on-dark", dot: "bg-on-dark" },
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
