"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { StatusBadge } from "@/components/ui/Badge";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { ProviderChip, PROVIDER_LABEL } from "@/components/ui/ProviderChip";
import { cn } from "@/lib/utils/cn";
import type { CloudProvider, EdgeKind } from "@/lib/taxonomy";
import type { TopoNodeData } from "@/lib/topology/types";

export type Relation = { data: TopoNodeData; kind: EdgeKind; direction: "out" | "in" };

const EDGE_VERB: Record<EdgeKind, string> = {
  contains: "contains",
  uses: "uses",
  "routes-to": "routes to",
  "depends-on": "depends on",
  "deployed-from": "deployed from",
};

/** Where "open in inventory" lands per provider (the estate explorers). */
const INVENTORY_HREF: Partial<Record<CloudProvider, string>> = {
  aws: "/aws",
  azure: "/azure",
  github: "/github",
};

const isProvider = (p: string): p is CloudProvider => p in PROVIDER_LABEL;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-micro uppercase text-ash">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-[12px] text-body" title={value}>
        {value}
      </span>
    </div>
  );
}

/**
 * Node detail — rebuilt on the Drawer primitive (portal, scrim, focus trap).
 * Identity header, status/drift badges, a key-attributes table in mono, the
 * relations list (click re-focuses the canvas onto that node) and an "open in
 * inventory" escape hatch into the estate explorer. The last node is cached in
 * a ref so the Drawer's exit slide keeps its content while closing.
 */
export function DetailPanel({
  node,
  relations,
  onClose,
  onSelect,
}: {
  node: TopoNodeData | null;
  relations: Relation[];
  onClose: () => void;
  onSelect: (urn: string) => void;
}) {
  const last = useRef<{ node: TopoNodeData; relations: Relation[] } | null>(null);
  if (node) last.current = { node, relations };
  const shown = node ? { node, relations } : last.current;

  return (
    <Drawer open={node !== null} onClose={onClose} width={400} title="Resource detail">
      {shown ? (
        <PanelBody node={shown.node} relations={shown.relations} onSelect={onSelect} />
      ) : null}
    </Drawer>
  );
}

function PanelBody({
  node,
  relations,
  onSelect,
}: {
  node: TopoNodeData;
  relations: Relation[];
  onSelect: (urn: string) => void;
}) {
  const inventoryHref = isProvider(node.provider) ? INVENTORY_HREF[node.provider] : undefined;

  return (
    <div className="flex flex-col">
      {/* identity */}
      <div className="flex items-start gap-3">
        <AppIconTile kind={node.kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium leading-[1.35] text-ink" title={node.name}>
            {node.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isProvider(node.provider) ? <ProviderChip provider={node.provider} /> : null}
            <span className="text-micro uppercase text-mute">{node.kind}</span>
          </div>
        </div>
      </div>

      {/* status + drift */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={node.status} />
        {node.drift !== "unknown" ? <StatusBadge status={node.drift} /> : null}
      </div>

      {/* key attributes */}
      <div className="mt-4 border-t border-hairline pt-2">
        <Row label="Service" value={node.service} />
        <Row label="Region" value={node.region ?? "global"} />
        <Row label="Account" value={`${node.accountLabel} · ${node.account}`} />
        <Row label="Environment" value={node.environment ?? "untagged"} />
        {node.nativeType ? <Row label="Type" value={node.nativeType} /> : null}
        <Row label="URN" value={node.urn} />
      </div>

      {/* collapsed cluster members */}
      {node.isCluster && node.clusterMembers ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="mb-1.5 text-micro uppercase text-ash">
            Grouped · {node.clusterMembers.length}
          </div>
          <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {node.clusterMembers.map((m) => (
              <li key={m} className="truncate rounded-md px-2 py-1 text-[12px] text-body" title={m}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* relations */}
      <div className="mt-3 border-t border-hairline pt-3">
        <div className="mb-1.5 text-micro uppercase text-ash">Connected · {relations.length}</div>
        {relations.length === 0 ? (
          <p className="py-2 text-[12.5px] text-mute">No mapped dependencies in this scope.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {relations.map((r) => (
              <li key={`${r.direction}-${r.kind}-${r.data.urn}`}>
                <button
                  type="button"
                  onClick={() => onSelect(r.data.urn)}
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-smooth hover:bg-surface-card"
                >
                  {r.direction === "out" ? (
                    <ArrowRight size={13} className="shrink-0 text-ash group-hover:text-info" />
                  ) : (
                    <ArrowLeft size={13} className="shrink-0 text-ash group-hover:text-info" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[12.5px] text-body group-hover:text-on-dark"
                      title={r.data.name}
                    >
                      {r.data.name}
                    </span>
                    <span className="block text-[10.5px] text-ash">
                      {r.direction === "out" ? EDGE_VERB[r.kind] : `${EDGE_VERB[r.kind]} this`} ·{" "}
                      {r.data.service}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* escape hatch into the estate explorer */}
      {inventoryHref ? (
        <div className="mt-4 border-t border-hairline pt-4">
          <Link
            href={inventoryHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-elevated px-3 py-1.5",
              "text-[12.5px] text-body transition-colors duration-150 ease-smooth hover:border-hairline-strong hover:text-on-dark",
            )}
          >
            Open in inventory
            <ExternalLink size={13} aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
