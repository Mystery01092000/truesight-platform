import { cn } from "@/lib/utils/cn";

/**
 * WatcherScene — the signature cinematic visual: the Argus aperture watching a
 * living cross-cloud estate. A central iris (Panoptes' eye) sits over a drifting
 * constellation of infrastructure nodes — AWS on the left arc, Azure on the
 * right, GitHub at the poles — with edges flowing inward as the watcher ingests
 * them, a lighthouse beam sweeping the field, and discovery pings rippling as
 * resources are found. This replaced the numbers dashboard: the product's thesis
 * is *a watcher over a live estate*, so we show that, not a count.
 *
 * The element fills its (positioned) parent — the hero frames it in a console
 * panel, /login uses it full-bleed as an ambient backdrop. Everything is
 * deterministic (fixed coordinates, index-derived delays) so server and client
 * render byte-identical SVG (no hydration drift), and every loop is CSS gated by
 * prefers-reduced-motion. Purely decorative and pointer-inert.
 */

type Cloud = "aws" | "azure" | "github";

const DOT: Record<Cloud, string> = {
  aws: "var(--color-accent-yellow)",
  azure: "var(--color-accent-blue)",
  github: "var(--color-on-dark)",
};

// viewBox is 480×360; the aperture sits at the optical centre.
const CX = 240;
const CY = 168;

/** Estate nodes — two cloud arcs flanking the eye, GitHub at the poles. */
const NODES: { x: number; y: number; cloud: Cloud; r: number }[] = [
  // AWS arc (left)
  { x: 70, y: 96, cloud: "aws", r: 13 },
  { x: 118, y: 58, cloud: "aws", r: 11 },
  { x: 54, y: 182, cloud: "aws", r: 12 },
  { x: 96, y: 262, cloud: "aws", r: 11 },
  { x: 158, y: 306, cloud: "aws", r: 10 },
  // Azure arc (right)
  { x: 410, y: 100, cloud: "azure", r: 13 },
  { x: 362, y: 58, cloud: "azure", r: 11 },
  { x: 426, y: 186, cloud: "azure", r: 12 },
  { x: 384, y: 264, cloud: "azure", r: 11 },
  { x: 322, y: 306, cloud: "azure", r: 10 },
  // GitHub poles (top + bottom centre)
  { x: 240, y: 40, cloud: "github", r: 11 },
  { x: 240, y: 322, cloud: "github", r: 10 },
];

/** A curated weave: every node reaches the eye; a few intra-cloud links thicken it. */
const WEAVE: [number, number][] = [
  [0, 1],
  [0, 2],
  [2, 3],
  [3, 4],
  [5, 6],
  [5, 7],
  [7, 8],
  [8, 9],
  [1, 10],
  [6, 10],
  [4, 11],
  [9, 11],
];

/** Distant estate stars — faint, twinkling depth behind the weave. */
const STARS: { x: number; y: number; r: number }[] = [
  { x: 40, y: 40, r: 1 },
  { x: 200, y: 70, r: 0.8 },
  { x: 300, y: 30, r: 1.1 },
  { x: 450, y: 60, r: 0.9 },
  { x: 30, y: 300, r: 1 },
  { x: 150, y: 200, r: 0.7 },
  { x: 330, y: 210, r: 0.8 },
  { x: 460, y: 320, r: 1 },
  { x: 210, y: 300, r: 0.7 },
  { x: 270, y: 140, r: 0.6 },
];

/** Nodes that periodically ripple — "a resource was just discovered." */
const PINGS = [0, 5, 10];

function ApertureEye() {
  // A scaled-up Argus mark at the field's centre — the same iris geometry as the
  // wordmark, so the hero eye and the nav mark read as one identity.
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const rO = 44;
    const rI = 24;
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      x1: round(CX + rO * Math.cos(a)),
      y1: round(CY + rO * Math.sin(a)),
      x2: round(CX + rI * Math.cos(a)),
      y2: round(CY + rI * Math.sin(a)),
    };
  });
  return (
    <g fill="none" strokeLinecap="round">
      {/* Watch-radius rings — the eye's reach over the whole estate. */}
      <circle cx={CX} cy={CY} r={110} strokeWidth={0.75} stroke="var(--color-iris)" opacity={0.12} />
      <circle cx={CX} cy={CY} r={78} strokeWidth={0.75} stroke="var(--color-iris)" opacity={0.18} />
      {/* Iris body */}
      <circle cx={CX} cy={CY} r={54} strokeWidth={1} stroke="var(--color-on-dark)" opacity={0.4} />
      <circle cx={CX} cy={CY} r={38} strokeWidth={1} stroke="var(--color-on-dark)" opacity={0.55} />
      {blades.map((b, i) => (
        <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} strokeWidth={1} stroke="var(--color-on-dark)" opacity={0.4} />
      ))}
      {/* Pupil — the one iris accent, with the "it's watching" pulse. */}
      <circle
        cx={CX}
        cy={CY}
        r={12}
        className="animate-pulse-ring"
        stroke="var(--color-iris)"
        strokeWidth={1.25}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle cx={CX} cy={CY} r={9} fill="var(--color-iris-bright)" stroke="none" />
    </g>
  );
}

export type WatcherSceneProps = {
  className?: string;
  /** "meet" shows the whole composition (hero panel); "slice" fills (backdrop). */
  fit?: "meet" | "slice";
};

export function WatcherScene({ className, fit = "slice" }: WatcherSceneProps) {
  return (
    <div className={cn("watcher-canvas absolute inset-0 overflow-hidden", className)}>
      <div className="watcher-beam" aria-hidden />
      <svg
        viewBox="0 0 480 360"
        preserveAspectRatio={`xMidYMid ${fit}`}
        className="watcher-scene size-full"
        role="img"
        aria-label="Argus watching a live estate of AWS and Azure resources"
      >
        {/* Distant stars */}
        {STARS.map((s, i) => (
          <circle
            key={`star-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="var(--color-on-dark)"
            className="watcher-star"
            style={{ animationDelay: `${(i % 5) * 0.6}s` }}
          />
        ))}

        {/* Edges — nodes flowing inward to the eye, plus the intra-cloud weave */}
        <g fill="none" strokeLinecap="round">
          {NODES.map((n, i) => (
            <line
              key={`c-${i}`}
              x1={n.x}
              y1={n.y}
              x2={CX}
              y2={CY}
              stroke="var(--color-iris)"
              strokeWidth={0.75}
              opacity={0.22}
              className="watcher-edge"
              style={{ animationDelay: `${(i % 6) * 0.18}s` }}
            />
          ))}
          {WEAVE.map(([a, b], i) => (
            <line
              key={`w-${i}`}
              x1={NODES[a].x}
              y1={NODES[a].y}
              x2={NODES[b].x}
              y2={NODES[b].y}
              stroke="var(--color-on-dark)"
              strokeWidth={0.75}
              opacity={0.14}
              strokeDasharray="3 6"
            />
          ))}
        </g>

        {/* Nodes — drifting resource tiles, provider-tinted pupil */}
        {NODES.map((n, i) => (
          <g
            key={`n-${i}`}
            className="watcher-node"
            style={{ animationDelay: `${(i % 6) * 0.5}s`, animationDuration: `${8 + (i % 4)}s` }}
          >
            {PINGS.includes(i) && (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill="none"
                stroke={DOT[n.cloud]}
                strokeWidth={1}
                className="animate-pulse-ring"
                style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${i * 0.9}s` }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={n.r} fill="var(--color-surface-card)" stroke="var(--color-hairline-strong)" strokeWidth={1} />
            <circle cx={n.x} cy={n.y} r={3} fill={DOT[n.cloud]} />
          </g>
        ))}

        {/* The watcher */}
        <ApertureEye />
      </svg>
    </div>
  );
}
