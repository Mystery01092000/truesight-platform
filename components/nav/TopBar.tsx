import { cn } from "@/lib/utils/cn";

/**
 * TopBar — presentational app header. A hairline bottom rule over the canvas,
 * a left breadcrumb slot, and a right slot for actions (search, avatar, CTA).
 * No auth or data logic — pure chrome.
 */
export type TopBarProps = {
  breadcrumb?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function TopBar({ breadcrumb, children, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-hairline bg-canvas/80 px-4 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-[14px] text-body">
        {breadcrumb}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}
