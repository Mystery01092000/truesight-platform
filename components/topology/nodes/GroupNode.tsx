"use client";

import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { Cloud, ChevronDown, ChevronUp } from "lucide-react";
import { ProviderChip } from "@/components/ui/ProviderChip";
import type { CloudProvider } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";

export type GroupNodeData = {
  label: string;
  account: string;
  count: number;
  /** Dominant provider of the band's members; null when mixed/unknown. */
  provider: CloudProvider | null;
  collapsed: boolean;
  onToggle: () => void;
};

export type GroupFlowNode = Node<GroupNodeData, "group">;

/**
 * A per-account/environment band drawn behind its member nodes — quiet hairline
 * frame with a header row: provider chip, account name, member count, and a
 * collapse/expand affordance. Collapsing hides the band's members (the canvas
 * folds the frame to header height); the band itself stays as the re-entry
 * point. Frame is pointer-inert; only the header is interactive.
 */
function GroupNodeImpl({ data }: NodeProps<GroupFlowNode>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "pointer-events-none h-full w-full rounded-[20px] border transition-colors duration-150 ease-smooth",
        data.collapsed ? "border-hairline bg-surface/40" : "border-hairline/40",
      )}
    >
      <div
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-hairline/60 bg-surface/80 py-1 pl-1.5 pr-1.5 backdrop-blur-sm"
        style={{ transform: "translate(14px, 12px)" }}
      >
        {data.provider ? (
          <ProviderChip provider={data.provider} />
        ) : (
          <Cloud size={12} className="ml-1 text-iris" aria-hidden />
        )}
        <span className="text-[11.5px] font-medium tracking-[0.01em] text-body">{data.label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">{data.account}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">· {data.count}</span>
        <button
          type="button"
          aria-label={data.collapsed ? `Expand ${data.label}` : `Collapse ${data.label}`}
          aria-expanded={!data.collapsed}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle();
          }}
          className="grid size-5 place-items-center rounded-full text-mute transition-colors duration-150 ease-smooth hover:bg-surface-elevated hover:text-on-dark"
        >
          {data.collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>
    </motion.div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
