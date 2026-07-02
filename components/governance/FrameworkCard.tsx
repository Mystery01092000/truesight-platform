import { cn } from "@/lib/utils/cn";
import { Surface } from "@/components/ui/Surface";

/**
 * FrameworkCard — a compact coverage tile for a single compliance framework.
 * Shows the framework name, pass/total ratio, and a thin monochrome progress
 * bar that reads on the surface ladder (no shadows, no saturated fills). The
 * bar width is driven by the real pass ratio computed in the query layer.
 */
export function FrameworkCard({
  name,
  description,
  passed,
  total,
  className,
}: {
  name: string;
  description?: string;
  passed: number;
  total: number;
  className?: string;
}) {
  const ratio = total > 0 ? (passed / total) * 100 : 0;
  const pct = Math.round(ratio);

  return (
    <Surface level={1} radius="lg" className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-medium leading-[1.4] text-ink">
            {name}
          </h3>
          {description ? (
            <p className="mt-0.5 truncate text-[12px] leading-[1.5] text-mute">
              {description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[13px] tabular-nums text-body">
          {passed}/{total}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-on-dark-mute transition-[width] duration-500 ease-smooth"
          style={{ width: `${ratio > 0 ? Math.max(ratio, 4) : 0}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-mute">passing controls</span>
        <span className="font-mono text-[11px] tabular-nums text-mute">{pct}%</span>
      </div>
    </Surface>
  );
}
