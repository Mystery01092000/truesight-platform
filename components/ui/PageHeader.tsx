import { cn } from "@/lib/utils/cn";

/**
 * PageHeader — the single page-level masthead every pillar screen shares.
 * Optional eyebrow above the h1, readable description below, actions pinned
 * to the end of the row, and children rendered underneath for filter bars.
 * Pillar screens with a glyph identity pass `icon` (rendered on a size-11
 * tile, neutral or iris-tinted); detail screens with identifier titles can
 * override the title treatment via `titleClassName` (e.g. font-mono).
 */
export type PageHeaderProps = {
  title: string;
  titleClassName?: string;
  description?: React.ReactNode;
  eyebrow?: string;
  icon?: React.ReactNode;
  iconTone?: "neutral" | "iris";
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

const ICON_TILE: Record<NonNullable<PageHeaderProps["iconTone"]>, string> = {
  neutral: "border-hairline bg-surface-card",
  iris: "border-iris bg-iris-soft",
};

export function PageHeader({
  title,
  titleClassName,
  description,
  eyebrow,
  icon,
  iconTone = "neutral",
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4">
        {icon ? (
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-lg border",
              ICON_TILE[iconTone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="mb-1.5 text-micro uppercase text-ash">{eyebrow}</p> : null}
          <h1 className={cn("font-display text-heading font-medium text-ink", titleClassName)}>
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-prose text-label text-mute">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
