"use client";

import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { Cloud } from "lucide-react";

export type GroupFlowNode = Node<{ label: string; account: string; count: number }, "group">;

/** A per-account container drawn behind its member nodes — quiet hairline frame
 *  with a header. Non-interactive; it only groups the weave visually. Fades and
 *  scales in (spring 120/18) as the first layer of the entrance choreography —
 *  the aperture "draws its bounds" before the resources arrive. */
function GroupNodeImpl({ data }: NodeProps<GroupFlowNode>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 120, damping: 18 }
      }
      className="pointer-events-none h-full w-full rounded-[20px] border border-hairline/40"
    >
      <div
        className="inline-flex items-center gap-2 rounded-full border border-hairline/60 bg-surface/70 px-3 py-1.5 backdrop-blur-sm"
        style={{ transform: "translate(14px, 14px)" }}
      >
        <Cloud size={12} className="text-iris" />
        <span className="text-[11.5px] font-medium tracking-[0.01em] text-body">{data.label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">{data.account}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">· {data.count}</span>
      </div>
    </motion.div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
