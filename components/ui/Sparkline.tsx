import { cn } from "@/lib/utils/cn";

/**
 * Sparkline — a tiny inline SVG trend line. No axes, no labels — just the
 * shape of the data so a glance reads the direction. The line strokes in
 * the system's `--color-iris` (the brand watching-eye accent), with a soft
 * gradient fill underneath. Width/height are fully controlled by the parent.
 */
export type SparklineProps = {
  /** The data series (any numbers; they're normalized to the viewBox). */
  data: number[];
  /** viewBox width (default 120). */
  width?: number;
  /** viewBox height (default 32). */
  height?: number;
  /** Stroke width in SVG units (default 1.5). */
  strokeWidth?: number;
  className?: string;
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `spark-${Math.round(width)}-${Math.round(height)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-iris)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--color-iris)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-iris)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
