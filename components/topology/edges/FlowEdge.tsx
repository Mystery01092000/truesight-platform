"use client";

import { memo, useContext, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { EdgeKind } from "@/lib/taxonomy";
import { TopoFocusContext } from "../focus";

export type FlowFlowEdge = Edge<{ kind: EdgeKind }, "flow">;

/**
 * Edge semantics rendered from the token vocabulary — iris for live data paths
 * (`uses`), info for routing, positive for deploy lineage, mute for logical
 * dependencies, stone hairline for structure. Nothing animates at idle: the
 * flowing dash plays ONLY while the edge is active (an endpoint is selected)
 * or hovered, and a small kind label surfaces on hover. Arrowheads are set by
 * the canvas per kind, color-matched to the stroke.
 */
const KIND_STYLE: Record<
  EdgeKind,
  { stroke: string; width: number; dash?: string; opacity: number; label: string }
> = {
  contains: { stroke: "var(--color-stone)", width: 1, opacity: 0.55, label: "contains" },
  uses: { stroke: "var(--color-iris)", width: 1.4, opacity: 0.55, label: "uses" },
  "routes-to": { stroke: "var(--color-info)", width: 1.4, opacity: 0.5, label: "routes to" },
  "depends-on": { stroke: "var(--color-mute)", width: 1.2, dash: "3 5", opacity: 0.45, label: "depends on" },
  "deployed-from": { stroke: "var(--color-positive)", width: 1.5, dash: "3 5", opacity: 0.6, label: "deployed from" },
};

function FlowEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<FlowFlowEdge>) {
  const focus = useContext(TopoFocusContext);
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  });

  const kind: EdgeKind = data?.kind ?? "uses";
  const base = KIND_STYLE[kind];
  const active = focus.edges.has(id) || hovered;
  const dimmed = focus.selected !== null && !focus.edges.has(id) && !hovered;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        // `topo-edge-flow` (globals) animates the dash — applied ONLY while
        // active so nothing moves at idle.
        className={active ? "topo-edge-flow" : undefined}
        style={{
          stroke: focus.edges.has(id) ? "var(--color-iris-bright)" : base.stroke,
          strokeWidth: active ? 2 : base.width,
          strokeDasharray: active ? undefined : base.dash,
          opacity: dimmed ? 0.08 : active ? 1 : base.opacity,
          transition: "opacity 150ms var(--ease-smooth), stroke-width 150ms var(--ease-smooth)",
        }}
      />
      {/* invisible wide hit path so hover works on a 1px stroke */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered ? (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="pointer-events-none absolute z-10 rounded-xs border border-hairline bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] leading-[1.4] tracking-[0.04em] text-mute"
          >
            {base.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const FlowEdge = memo(FlowEdgeImpl);
