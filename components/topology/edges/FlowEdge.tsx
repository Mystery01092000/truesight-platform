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
  uses: { stroke: "var(--color-accent-blue)", width: 1.4, flow: true },
  "routes-to": { stroke: "var(--color-accent-blue)", width: 1.4, flow: true },
  "depends-on": { stroke: "var(--color-mute)", dash: "2 5", width: 1.1, flow: false },
  "deployed-from": { stroke: "var(--color-accent-green)", dash: "2 5", width: 1.1, flow: false },
};

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

  return (
    <BaseEdge
      id={id}
      path={path}
      className={flowing ? "topo-edge-flow" : undefined}
      style={{
        stroke: active ? "var(--color-accent-blue)" : base.stroke,
        strokeWidth: active ? 2 : base.width,
        strokeDasharray: flowing ? undefined : base.dash,
        opacity: dimmed ? 0.09 : active ? 1 : 0.5,
        transition: "opacity .25s ease, stroke-width .2s ease",
      }}
    />
  );
}

export const FlowEdge = memo(FlowEdgeImpl);
