"use client";

import { memo, useContext } from "react";
import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";
import type { EdgeKind } from "@/lib/taxonomy";
import { TopoFocusContext } from "../focus";

export type FlowFlowEdge = Edge<{ kind: EdgeKind }, "flow">;

/** Base style per edge semantic. `uses`/`routes-to` are the live data paths
 *  (accent, flowing dashes); `contains` is a quiet structural hairline;
 *  `depends-on`/`deployed-from` are dashed dependency lines. */
const KIND_BASE: Record<EdgeKind, { stroke: string; dash?: string; width: number; flow: boolean }> = {
  contains: { stroke: "var(--color-stone)", width: 1, flow: false },
  uses: { stroke: "var(--color-iris)", width: 1.4, flow: true },
  "routes-to": { stroke: "var(--color-iris)", width: 1.4, flow: true },
  "depends-on": { stroke: "var(--color-mute)", dash: "2 5", width: 1.1, flow: false },
  "deployed-from": { stroke: "var(--color-accent-green)", dash: "2 5", width: 1.1, flow: false },
};

/** Deterministic 0..1 phase from the edge id so packets don't all pulse in unison. */
function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return (h % 1000) / 1000;
}

function FlowEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowFlowEdge>) {
  const focus = useContext(TopoFocusContext);
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  });

  const kind: EdgeKind = data?.kind ?? "uses";
  const base = KIND_BASE[kind];
  const active = focus.edges.has(id);
  const dimmed = focus.selected !== null && !active;
  const flowing = (base.flow || active) && !dimmed;
  const stroke = active ? "var(--color-iris-bright)" : base.stroke;
  const begin = `-${(phaseOf(id) * 2.2).toFixed(2)}s`;
  const dur = active ? "1.3s" : "2.2s";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: active ? 2 : base.width,
          strokeDasharray: base.dash,
          opacity: dimmed ? 0.08 : active ? 1 : 0.42,
          transition: "opacity .25s ease, stroke-width .2s ease",
        }}
      />
      {/* Glowing data packet travelling the dependency path — the "living system". */}
      {flowing ? (
        <g className="topo-flow-dot">
          <circle r={active ? 4 : 3} fill={stroke} opacity={0.2}>
            <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
          </circle>
          <circle r={active ? 1.9 : 1.5} fill={stroke}>
            <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
          </circle>
        </g>
      ) : null}
    </>
  );
}

export const FlowEdge = memo(FlowEdgeImpl);
