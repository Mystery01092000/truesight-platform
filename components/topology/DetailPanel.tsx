"use client";

import { motion } from "motion/react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { cn } from "@/lib/utils/cn";
import type { EdgeKind, ResourceStatus } from "@/lib/taxonomy";
import type { TopoNodeData } from "@/lib/topology/types";

export type Relation = { data: TopoNodeData; kind: EdgeKind; direction: "out" | "in" };

const STATUS_LABEL: Record<ResourceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  stopped: "Stopped",
  unknown: "Unknown",
};
const STATUS_DOT: Record<ResourceStatus, string> = {
  healthy: "bg-accent-green",
  degraded: "bg-accent-yellow",
  stopped: "bg-accent-red",
  unknown: "bg-stone",
};

const EDGE_VERB: Record<EdgeKind, string> = {
  contains: "contains",
  uses: "uses",
  "routes-to": "routes to",
  "depends-on": "depends on",
  "deployed-from": "deployed from",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11.5px] uppercase tracking-[0.04em] text-ash">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] text-body" title={value}>
        {value}
      </span>
    </div>
  );
}

export function DetailPanel({
  node,
  relations,
  onClose,
  onSelect,
}: {
  node: TopoNodeData;
  relations: Relation[];
  onClose: () => void;
  onSelect: (urn: string) => void;
}) {
  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="pointer-events-auto absolute right-3 top-3 bottom-3 z-20 flex w-[320px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-elevated/95 backdrop-blur-md"
    >
      <header className="flex items-start gap-3 border-b border-hairline px-4 py-3.5">
        <AppIconTile kind={node.kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium leading-tight text-ink" title={node.name}>
            {node.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", STATUS_DOT[node.status])} aria-hidden />
            <span className="text-[11.5px] text-mute">{STATUS_LABEL[node.status]}</span>
            <span className="text-stone">·</span>
            <span className="text-[11.5px] uppercase tracking-[0.03em] text-mute">{node.kind}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-mute transition-colors hover:bg-surface-card hover:text-on-dark"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="border-b border-hairline pb-2">
          <Row label="Service" value={node.service} />
          <Row label="Region" value={node.region ?? "global"} />
          <Row label="Account" value={`${node.accountLabel} · ${node.account}`} />
          <Row label="Environment" value={node.environment ?? "untagged"} />
          {node.nativeType ? <Row label="Type" value={node.nativeType} /> : null}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-[11.5px] uppercase tracking-[0.04em] text-ash">
            Connected · {relations.length}
          </div>
          {relations.length === 0 ? (
            <p className="py-2 text-[12.5px] text-mute">No mapped dependencies in this scope.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {relations.map((r) => (
                <li key={`${r.direction}-${r.kind}-${r.data.urn}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.data.urn)}
                    className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-card"
                  >
                    {r.direction === "out" ? (
                      <ArrowRight size={13} className="shrink-0 text-ash group-hover:text-accent-blue" />
                    ) : (
                      <ArrowLeft size={13} className="shrink-0 text-ash group-hover:text-accent-blue" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-body group-hover:text-on-dark" title={r.data.name}>
                        {r.data.name}
                      </span>
                      <span className="block text-[10.5px] text-ash">
                        {r.direction === "out" ? EDGE_VERB[r.kind] : `${EDGE_VERB[r.kind]} this`} · {r.data.service}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
