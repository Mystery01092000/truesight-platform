import type { Severity, DriftStatus, ResourceStatus } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";

/**
 * Badge — small neutral / info label. Chrome stays monochrome (`badge`);
 * the only saturated variant is the translucent `info-soft` "New/Beta" tag.
 */
export type BadgeVariant = "badge" | "info-soft";

const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[12px] leading-[1.5] tracking-[0.4px]";

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  badge: "bg-surface-elevated text-on-dark-mute",
  "info-soft": "bg-accent-blue-soft text-accent-blue",
};

export function Badge({
  variant = "badge",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span className={cn(BADGE_BASE, BADGE_VARIANTS[variant], className)} {...props} />
  );
}

/**
 * StatusBadge — maps a Severity, DriftStatus, or ResourceStatus (health) to the
 * accent-soft fill + accent text pair. This is one of the rare, deliberate
 * places saturated color reads on chrome, kept legible via the soft (15% alpha)
 * tint behind accent text.
 *
 * Uses the CANONICAL taxonomy enums (underscore drift form: `in_sync`,
 * `missing_in_cloud`, `unmanaged`) — never a local redefinition.
 */
export type StatusKind = Severity | DriftStatus | ResourceStatus;

type Tone = "red" | "yellow" | "green" | "blue" | "mute";

const STATUS_TONE: Record<StatusKind, Tone> = {
  // severity
  critical: "red",
  high: "red",
  medium: "yellow",
  low: "mute",
  info: "blue",
  // drift (canonical underscore form)
  in_sync: "green",
  drifted: "yellow",
  missing_in_cloud: "red",
  unmanaged: "blue",
  unknown: "mute",
  // health (ResourceStatus)
  healthy: "green",
  degraded: "yellow",
  stopped: "red",
};

const TONE_CLASS: Record<Tone, { fill: string; dot: string }> = {
  red: { fill: "bg-accent-red-soft text-accent-red", dot: "bg-accent-red" },
  yellow: { fill: "bg-accent-yellow-soft text-accent-yellow", dot: "bg-accent-yellow" },
  green: { fill: "bg-accent-green-soft text-accent-green", dot: "bg-accent-green" },
  blue: { fill: "bg-accent-blue-soft text-accent-blue", dot: "bg-accent-blue" },
  mute: { fill: "bg-surface-elevated text-mute", dot: "bg-mute" },
};

const LABELS: Partial<Record<StatusKind, string>> = {
  in_sync: "In sync",
  drifted: "Drifted",
  missing_in_cloud: "Missing in cloud",
  unmanaged: "Unmanaged",
  healthy: "Healthy",
  degraded: "Degraded",
  stopped: "Stopped",
};

export function StatusBadge({
  status,
  label,
  dot = true,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  status: StatusKind;
  label?: string;
  dot?: boolean;
}) {
  const tone = TONE_CLASS[STATUS_TONE[status]];
  const text = label ?? LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn(BADGE_BASE, tone.fill, className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />}
      {text}
    </span>
  );
}
