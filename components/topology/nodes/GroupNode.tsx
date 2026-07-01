"use client";

import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Cloud } from "lucide-react";

export type GroupFlowNode = Node<{ label: string; account: string; count: number }, "group">;

/** A per-account container drawn behind its member nodes — quiet hairline frame
 *  with a header. Non-interactive; it only groups the weave visually. */
function GroupNodeImpl({ data }: NodeProps<GroupFlowNode>) {
  return (
    <div className="pointer-events-none h-full w-full rounded-[20px] border border-hairline/40">
      <div className="inline-flex items-center gap-2 rounded-full border border-hairline/60 bg-surface/70 px-3 py-1.5 backdrop-blur-sm" style={{ transform: "translate(14px, 14px)" }}>
        <Cloud size={12} className="text-iris" />
        <span className="text-[11.5px] font-medium tracking-[0.01em] text-body">{data.label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">{data.account}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ash">· {data.count}</span>
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
