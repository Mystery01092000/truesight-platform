"use client";

import { memo, useContext } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import * as LucideIcons from "lucide-react";
import { Box, Layers, type LucideIcon } from "lucide-react";
import { kindAccent, kindIcon, type AccentToken, type ResourceStatus, DRIFT_RING, type DriftStatus } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";
import type { TopoNodeData } from "@/lib/topology/types";
import { TopoFocusContext } from "../focus";

export type ResourceFlowNode = Node<TopoNodeData, "resource">;

const ICON_SET = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
const resolveIcon = (name: string): LucideIcon => ICON_SET[name] ?? Box;

const ACCENT_ICON: Record<AccentToken, string> = {
  "accent-blue": "text-accent-blue",
  "accent-green": "text-accent-green",
  "accent-red": "text-accent-red",
  "accent-yellow": "text-accent-yellow",
  mute: "text-mute",
};
const ACCENT_TINT: Record<AccentToken, string> = {
  "accent-blue": "bg-accent-blue-soft",
  "accent-green": "bg-accent-green-soft",
  "accent-red": "bg-accent-red-soft",
  "accent-yellow": "bg-accent-yellow-soft",
  mute: "bg-white/5",
};

const STATUS_RAIL: Record<ResourceStatus, string> = {
  healthy: "bg-accent-green",
  degraded: "bg-accent-yellow",
  stopped: "bg-accent-red",
  unknown: "bg-stone",
};

/** Border tint for the one-shot drift pulse halo — keyed to the same canonical
 *  {@link DriftStatus} as the ring. `in_sync`/`unknown` emit no halo. */
const DRIFT_HALO: Record<DriftStatus, string> = {
  in_sync: "",
  drifted: "border-accent-yellow/50",
  missing_in_cloud: "border-accent-red/60",
  unmanaged: "border-accent-blue/40",
  unknown: "",
};

/** A single resource in the weave — a surface-card tile, kind-tinted glyph, a
 *  left status rail, and near-invisible handles so edges attach L→R. */
function ResourceNodeImpl({ data, selected }: NodeProps<ResourceFlowNode>) {
  const reduce = useReducedMotion();
  const focus = useContext(TopoFocusContext);
  const accent = kindAccent[data.kind] ?? "mute";
  const Icon = data.isCluster ? Layers : resolveIcon(kindIcon[data.kind]);

  const isFocused = focus.selected === data.urn;
  const isNeighbor = focus.neighbors.has(data.urn);
  const dimmed = focus.selected !== null && !isFocused && !isNeighbor;

  const handleStyle = { width: 7, height: 7, opacity: 0, border: "none" } as const;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.94, y: 6 }}
      animate={{ opacity: dimmed ? 0.28 : 1, scale: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { opacity: { duration: 0.45, delay: data.appearDelay }, scale: { type: "spring", stiffness: 220, damping: 24, delay: data.appearDelay }, y: { type: "spring", stiffness: 220, damping: 24, delay: data.appearDelay } }
      }
      className="group relative"
      style={{ width: 216 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
      {/* focus spotlight — a soft aperture glow behind the selected node */}
      {selected || isFocused ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-2 z-0 rounded-2xl bg-iris-soft blur-lg"
        />
      ) : null}
      {/* one-shot drift pulse halo — announces the "no blind spots" ring once
       *  the entrance settles, then goes quiet (driven by .topo-pulse on the canvas). */}
      {DRIFT_HALO[data.drift as DriftStatus] && !data.isCluster ? (
        <span
          aria-hidden
          className={cn(
            "topo-drift-halo pointer-events-none absolute inset-0 z-[5] rounded-lg border-2 opacity-0",
            DRIFT_HALO[data.drift as DriftStatus],
          )}
        />
      ) : null}
      {/* stacked-card shadow — signals a collapsed group of resources */}
      {data.isCluster ? (
        <span
          aria-hidden
          className="absolute left-1.5 right-1.5 top-1.5 h-full rounded-lg border border-hairline bg-surface-card/60"
          style={{ transform: "translateY(5px)" }}
        />
      ) : null}
      <div
        className={cn(
          "relative z-10 flex items-center gap-2.5 overflow-hidden rounded-lg border bg-surface-card px-2.5 py-2 transition-colors duration-150",
          "hover:border-hairline-strong hover:bg-surface-elevated",
          data.isCluster && "border-dashed",
          DRIFT_RING[data.drift as DriftStatus] ?? "",
          selected || isFocused
            ? "border-iris/70 ring-1 ring-iris/40"
            : isNeighbor
              ? "border-hairline-strong"
              : "border-hairline",
        )}
      >
        {/* status rail */}
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", STATUS_RAIL[data.status])} aria-hidden />
        {/* kind glyph */}
        <div className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-hairline bg-surface">
          <span className={cn("absolute inset-0", ACCENT_TINT[accent])} aria-hidden />
          <Icon size={17} strokeWidth={1.75} className={cn("relative", ACCENT_ICON[accent])} />
        </div>
        {/* labels */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium leading-tight text-ink" title={data.name}>
            {data.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none text-mute">
            <span className="uppercase tracking-[0.04em]">
              {data.isCluster ? "grouped" : data.service}
            </span>
            {data.region ? <span className="text-stone">·</span> : null}
            {data.region ? <span className="truncate font-mono">{data.region}</span> : null}
          </div>
        </div>
        {data.isCluster ? (
          <span className="shrink-0 rounded-full border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-mute">
            {data.clusterCount}
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
    </motion.div>
  );
}

export const ResourceNode = memo(ResourceNodeImpl);
