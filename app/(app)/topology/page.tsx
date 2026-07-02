import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";
import { getTopology } from "@/lib/topology/graph";
import {
  TOPO_ENV_SCOPES,
  TOPO_SCOPE_LABEL,
  TOPO_LAYOUT_MODES,
  TOPO_PROVIDERS,
  type TopoEnvScope,
  type TopoLayoutMode,
  type TopoProvider,
} from "@/lib/topology/types";
import { TopologyCanvas } from "@/components/topology/TopologyCanvas";
import { TopoToolbar } from "@/components/topology/TopoToolbar";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Topology" };
export const dynamic = "force-dynamic";

function normalizeScope(v: string | string[] | undefined): TopoEnvScope {
  const s = Array.isArray(v) ? v[0] : v;
  return (TOPO_ENV_SCOPES as readonly string[]).includes(s ?? "")
    ? (s as TopoEnvScope)
    : "prod";
}

function normalizeLayout(v: string | string[] | undefined): TopoLayoutMode {
  const s = Array.isArray(v) ? v[0] : v;
  return (TOPO_LAYOUT_MODES as readonly string[]).includes(s ?? "")
    ? (s as TopoLayoutMode)
    : "layered";
}

function normalizeProvider(v: string | string[] | undefined): TopoProvider {
  const s = Array.isArray(v) ? v[0] : v;
  return (TOPO_PROVIDERS as readonly string[]).includes(s ?? "")
    ? (s as TopoProvider)
    : "all";
}

export default async function TopologyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const scope = normalizeScope(sp.env);
  const layout = normalizeLayout(sp.layout);
  const provider = normalizeProvider(sp.provider);
  const graph = await getTopology(scope, layout, provider);
  const accountN = graph.stats.accounts.length;

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col">
      <header className="mb-3">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-medium leading-tight tracking-[0.2px] text-ink">
              Topology
            </h1>
            <p className="mt-1 max-w-prose text-[13.5px] leading-[1.55] text-mute">
              The live weave — <span className="font-mono text-body">{graph.stats.nodes}</span>{" "}
              resources and <span className="font-mono text-body">{graph.stats.edges}</span>{" "}
              dependencies across <span className="font-mono text-body">{accountN}</span> account
              {accountN === 1 ? "" : "s"}. Select any node to trace what it touches.
            </p>
          </div>
        </div>
        <TopoToolbar
          scope={scope}
          layout={layout}
          provider={provider}
          nodes={graph.stats.nodes}
          edges={graph.stats.edges}
        />
      </header>

      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title={`No woven resources in ${TOPO_SCOPE_LABEL[scope]}`}
          description="Nothing in this scope has mapped dependencies yet. Widen the view to every environment and cloud, or run a sync to discover more of the estate."
          action={
            <Link
              href="/topology?env=all&layout=layered&provider=all"
              className="inline-flex items-center rounded-md border border-hairline bg-surface-elevated px-3 py-1.5 text-[13px] text-on-dark transition-colors duration-150 ease-smooth hover:border-hairline-strong"
            >
              View the whole estate
            </Link>
          }
          className="flex-1"
        />
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-xl border border-hairline bg-surface">
          <TopologyCanvas graph={graph} remountKey={layout} />
        </div>
      )}
    </div>
  );
}
