"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getService } from "@/lib/forge/catalog";
import { CATEGORY_ICON, PROVIDER_HEX } from "@/components/forge/service-icons";
import type { ForgeFlowNode } from "@/components/forge/flow";
import { cn } from "@/lib/utils/cn";

/** Compact resource card: provider dot, service label, user name, error ring. */
export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps<ForgeFlowNode>) {
  const svc = getService(data.forge.serviceId);
  const Icon = svc ? CATEGORY_ICON[svc.category] : null;
  const hasError = data.errors.length > 0;
  return (
    <div
      className={cn(
        "min-w-40 rounded-lg border bg-surface-card px-3 py-2 shadow-none transition-colors",
        selected ? "border-iris" : "border-hairline",
        hasError && "ring-1 ring-negative",
      )}
      title={hasError ? data.errors.join("\n") : undefined}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-hairline !bg-surface-card" />
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={14} strokeWidth={1.5} className="shrink-0 text-mute" /> : null}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: PROVIDER_HEX[data.provider] }} aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ash">{data.serviceLabel}</span>
          </div>
          <div className="truncate text-[13px] font-medium text-ink">{data.forge.name}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-hairline !bg-surface-card" />
    </div>
  );
});
