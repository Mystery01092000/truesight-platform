import { cn } from "@/lib/utils/cn";

/**
 * Keycap — inline keyboard glyph. The system's one "physical-key" depth cue:
 * a faint key-bg gradient (key-bg-start → key-bg-end) on a surface-card tile
 * with a hairline edge. Renders shortcut hints like `⌘`, `K`, `⏎`, `Esc`.
 */
export function Keycap({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-hairline px-1.5",
        "text-label font-medium leading-none text-body",
        "bg-[linear-gradient(180deg,var(--color-key-bg-start),var(--color-key-bg-end))]",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
