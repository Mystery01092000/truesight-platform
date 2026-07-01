"use client";

/** Reads the weave: what the edge styles and status rail mean. Kept quiet in the
 *  corner so it explains without competing with the canvas. */
function Line({ stroke, dash, flow, label }: { stroke: string; dash?: string; flow?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="8" viewBox="0 0 26 8" className="shrink-0">
        <line
          x1="1"
          y1="4"
          x2="25"
          y2="4"
          stroke={stroke}
          strokeWidth={flow ? 1.6 : 1.2}
          strokeDasharray={flow ? "5 6" : dash}
          className={flow ? "topo-edge-flow" : undefined}
        />
      </svg>
      <span className="text-[11px] text-mute">{label}</span>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      <span className="text-[11px] text-mute">{label}</span>
    </div>
  );
}

export function Legend() {
  return (
    <div className="rounded-lg border border-hairline bg-surface/85 px-3 py-2.5 backdrop-blur-md">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.06em] text-ash">The weave</div>
      <div className="flex flex-col gap-1.5">
        <Line stroke="var(--color-accent-blue)" flow label="uses / routes" />
        <Line stroke="var(--color-stone)" label="contains" />
        <Line stroke="var(--color-mute)" dash="2 4" label="depends on" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-hairline pt-2">
        <Dot color="var(--color-accent-green)" label="healthy" />
        <Dot color="var(--color-stone)" label="unknown" />
      </div>
    </div>
  );
}
