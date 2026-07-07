"use client";

import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { PROVIDER_HEX } from "@/components/forge/service-icons";
import type { ForgeFlowNode } from "@/components/forge/flow";
import { cn } from "@/lib/utils/cn";

/** Translucent group container (VPC / subnet / resource group / cluster). */
export const ContainerNode = memo(function ContainerNode({ data, selected }: NodeProps<ForgeFlowNode>) {
  const hasError = data.errors.length > 0;
  return (
    <div
      className={cn(
        "h-full w-full rounded-xl border border-dashed bg-white/[0.02] transition-colors",
        selected ? "border-iris" : "border-hairline",
        hasError && "ring-1 ring-negative",
      )}
      title={hasError ? data.errors.join("\n") : undefined}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-iris"
        handleClassName="!size-2 !rounded-sm !border-iris !bg-surface-card"
      />
      <div className="pointer-events-none flex items-center gap-1.5 px-3 pt-2">
        <span className="size-1.5 rounded-full" style={{ background: PROVIDER_HEX[data.provider] }} aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ash">{data.serviceLabel}</span>
        <span className="truncate text-[12px] font-medium text-body">{data.forge.name}</span>
      </div>
    </div>
  );
});
