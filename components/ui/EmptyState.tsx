import { cn } from "@/lib/utils/cn";
import { Surface } from "@/components/ui/Surface";

/**
 * EmptyState — the single consistent degraded/empty/error surface across every
 * pillar. Speaks in the Truesight persona ("Truesight hasn't mapped this estate yet")
 * instead of generic "no data" copy. Monochrome glyph + prose + one optional
 * CTA. Never a broken screen — always a guided next step.
 */
export type EmptyStateProps = {
  /** The glyph icon node (a lucide component rendered at its natural size). */
  icon?: React.ReactNode;
  /** Primary message, e.g. "Truesight hasn't mapped this estate yet." */
  title: string;
  /** Supporting prose, e.g. "Trigger a sync to discover your cloud resources." */
  description?: string;
  /** Optional call-to-action (a Button or Link). */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Surface
      level={1}
      radius="lg"
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-lg border border-hairline bg-surface-card [&>svg]:size-6 [&>svg]:text-mute">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-[18px] font-medium leading-[1.4] text-ink">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-sm text-[14px] leading-[1.6] text-mute">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Surface>
  );
}
