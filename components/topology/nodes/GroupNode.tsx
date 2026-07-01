"use client";

import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { Cloud } from "lucide-react";

export type GroupFlowNode = Node<{ label: string; account: string; count: number }, "group">;

/** A per-account container drawn behind its member nodes — quiet hairline frame
 *  with a header. Non-interactive; it only groups the weave visually. */
function GroupNodeImpl({ data }: NodeProps<GroupFlowNode>) {
  return (
    <div className="pointer-events-none h-full w-full rounded-2xl border border-hairline/60 bg-white/[0.012]">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <Cloud size={13} className="text-mute" />
        <span className="text-[12px] font-medium tracking-[0.01em] text-body">{data.label}</span>
        <span className="text-[11px] tabular-nums text-ash">· {data.account}</span>
        <span className="ml-auto text-[11px] tabular-nums text-ash">{data.count} resources</span>
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
