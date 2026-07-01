import { cn } from "@/lib/utils/cn";

/**
 * The Argus mark — Panoptes, the all-seeing watcher. An aperture/iris: two
 * concentric hairline rings with radial blades converging on a solid pupil.
 * Monochrome (inherits currentColor). When `watching`, a ring pulses out of the
 * pupil (animate-pulse-ring) — the signature "it's watching" tell.
 */
export type LogoMarkProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  watching?: boolean;
};

export function LogoMark({
  size = 24,
  watching = false,
  className,
  ...props
}: LogoMarkProps) {
  // Round to 3dp so server and client serialize identical coordinate strings
  // (raw Math.cos/sin floats differ in their last digit → hydration mismatch).
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const rO = 7;
    const rI = 3.7;
    return {
      x1: r(12 + rO * Math.cos(a)),
      y1: r(12 + rO * Math.sin(a)),
      x2: r(12 + rI * Math.cos(a)),
      y2: r(12 + rI * Math.sin(a)),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      className={cn("text-ink", className)}
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="10.5" opacity="0.28" />
      <circle cx="12" cy="12" r="7.4" opacity="0.5" />
      {blades.map((b, i) => (
        <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} opacity="0.5" />
      ))}
      {watching && (
        <circle
          cx="12"
          cy="12"
          r="2.6"
          className="animate-pulse-ring"
          stroke="var(--color-iris)"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
      {/* The pupil is the one accent point — iris when watching, else monochrome. */}
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill={watching ? "var(--color-iris-bright)" : "currentColor"}
        stroke="none"
      />
    </svg>
  );
}

export type LogoProps = {
  size?: number;
  watching?: boolean;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

export function Logo({
  size = 22,
  watching = false,
  showWordmark = true,
  className,
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark size={size} watching={watching} />
      {showWordmark && (
        <span
          className={cn(
            "font-display text-[18px] font-semibold leading-none tracking-[-0.01em] text-ink",
            wordmarkClassName,
          )}
        >
          Argus
        </span>
      )}
    </span>
  );
}
