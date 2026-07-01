import { cn } from "@/lib/utils/cn";

/**
 * Surface — the ONLY elevation primitive. Depth is the 4-step surface-color ladder
 * (canvas → surface → elevated → card), never a drop shadow. `level` picks the rung;
 * levels 1–3 carry the universal 1px hairline edge.
 */
const LEVELS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-canvas",
  1: "bg-surface border border-hairline",
  2: "bg-surface-elevated border border-hairline",
  3: "bg-surface-card border border-hairline",
};

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  level?: 0 | 1 | 2 | 3;
  radius?: "sm" | "md" | "lg" | "xl" | "none";
};

const RADII: Record<NonNullable<SurfaceProps["radius"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export function Surface({
  level = 1,
  radius = "lg",
  className,
  ...props
}: SurfaceProps) {
  return (
    <div className={cn(LEVELS[level], RADII[radius], className)} {...props} />
  );
}
