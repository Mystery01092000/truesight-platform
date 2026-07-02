"use client";

import { memo, useContext } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { DRIFT_RING, type ResourceStatus, type DriftStatus } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";
import { NODE_W, NODE_H, type TopoNodeData } from "@/lib/topology/types";
import { TopoFocusContext, TopoRevealedContext } from "../focus";

export type ResourceFlowNode = Node<TopoNodeData, "resource">;

/** Status dot fill — semantic tokens only. */
const STATUS_DOT: Record<ResourceStatus, string> = {
  healthy: "bg-positive",
  degraded: "bg-warning",
  stopped: "bg-critical",
  unknown: "bg-stone",
};

/**
 * A single resource in the weave — a surface-card tile carrying the full
 * identity read: kind-tinted AppIconTile glyph, name, `service · nativeType`
 * in mono micro, status dot (pulsing ONLY while actively degraded), drift ring
 * when drifted, and a region chip. Entrance is gated on TopoRevealedContext so
 * the whole canvas choreographs once, after the discovery stream resolves.
 * Cluster summary nodes wear a stacked-card shadow and an expand affordance.
 */
function ResourceNodeImpl({ data, selected }: NodeProps<ResourceFlowNode>) {
  const reduce = useReducedMotion();
  const focus = useContext(TopoFocusContext);
  const revealed = useContext(TopoRevealedContext);

  const isFocused = focus.selected === data.urn;
  const isNeighbor = focus.neighbors.has(data.urn);
  const dimmed = focus.selected !== null && !isFocused && !isNeighbor;
  const show = revealed !== "hidden" || !!reduce;
  // Staggered delay plays only during the one reveal choreography; nodes
  // remounted afterwards (viewport culling re-mounts on pan) enter instantly.
  // Cluster members keep their small grid stagger — they mount on expand.
  const delay =
    revealed === "revealing" || data.isClusterMember ? data.appearDelay : 0;

  const handleStyle = { width: 7, height: 7, opacity: 0, border: "none" } as const;
  const subline = data.isCluster
    ? `${data.clusterCount} collapsed · ${data.service}`
    : data.nativeType
      ? `${data.service} · ${data.nativeType}`
      : data.service;

  return (
    // Outer layer: entrance only (runs once when the canvas reveals).
    // Inner layer: selection dimming at 150ms so focus feedback stays instant.
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }
      }
      className="group relative"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
      {/* focus spotlight — a soft aperture glow behind the selected node */}
      {selected || isFocused ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-2 z-0 rounded-2xl bg-iris-soft blur-lg"
        />
      ) : null}
      {/* stacked-card shadow — signals a collapsed group of resources */}
      {data.isCluster && !data.expanded ? (
        <span
          aria-hidden
          className="absolute left-1.5 right-1.5 top-1.5 h-full rounded-lg border border-hairline bg-surface-card/60"
          style={{ transform: "translateY(5px)" }}
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 flex h-full items-center gap-3 overflow-hidden rounded-lg border bg-surface-card px-3 transition-colors duration-150 ease-smooth",
          "hover:border-hairline-strong hover:bg-surface-elevated",
          data.isCluster && "border-dashed",
          DRIFT_RING[data.drift as DriftStatus] ?? "",
          selected || isFocused
            ? "border-iris/70 ring-1 ring-iris/40"
            : isNeighbor
              ? "border-hairline-strong"
              : "border-hairline",
        )}
        style={{ opacity: dimmed ? 0.25 : 1, transition: "opacity 150ms var(--ease-smooth)" }}
      >
        {/* kind glyph on the card surface */}
        <AppIconTile kind={data.kind} />
        {/* identity column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[1.35] text-ink"
              title={data.name}
            >
              {data.name}
            </span>
            {/* status dot — pulses ONLY while actively degraded (sanctioned loop) */}
            <span className="relative grid size-2.5 shrink-0 place-items-center" aria-hidden>
              {data.status === "degraded" && !reduce ? (
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-warning" />
              ) : null}
              <span className={cn("relative size-1.5 rounded-full", STATUS_DOT[data.status])} />
            </span>
          </div>
          <div
            className="mt-0.5 truncate font-mono text-[10.5px] leading-[1.4] tracking-[0.02em] text-mute"
            title={subline}
          >
            {subline}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {data.region ? (
              <span className="truncate rounded-xs border border-hairline-soft bg-surface px-1.5 py-px font-mono text-[9.5px] leading-[1.5] text-ash">
                {data.region}
              </span>
            ) : null}
            {data.isCluster ? (
              <span className="inline-flex items-center gap-1 rounded-xs border border-hairline-soft bg-surface px-1.5 py-px font-mono text-[9.5px] leading-[1.5] tabular-nums text-ash">
                {data.expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                {data.expanded ? "collapse" : `expand ${data.clusterCount}`}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
    </motion.div>
  );
}

export const ResourceNode = memo(ResourceNodeImpl);
