import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { getTopology } from "@/lib/topology/graph";
import {
  TOPO_ENV_SCOPES,
  TOPO_SCOPE_LABEL,
  type TopoEnvScope,
} from "@/lib/topology/types";
import { TopologyCanvas } from "@/components/topology/TopologyCanvas";
import { ScopeTabs } from "@/components/topology/ScopeTabs";

export const metadata: Metadata = { title: "Topology" };
export const dynamic = "force-dynamic";

function normalizeScope(v: string | string[] | undefined): TopoEnvScope {
  const s = Array.isArray(v) ? v[0] : v;
  return (TOPO_ENV_SCOPES as readonly string[]).includes(s ?? "")
    ? (s as TopoEnvScope)
    : "prod";
}

export default async function TopologyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const scope = normalizeScope(sp.env);
  const graph = await getTopology(scope);
  const accountN = graph.stats.accounts.length;

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
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
        <ScopeTabs active={scope} />
      </header>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-hairline bg-surface">
        {graph.nodes.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto grid size-11 place-items-center rounded-lg border border-hairline bg-surface-card">
                <Workflow size={20} className="text-mute" />
              </div>
              <h2 className="mt-4 text-[16px] font-medium text-ink">
                No woven resources in {TOPO_SCOPE_LABEL[scope]}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-body">
                Nothing in this scope has mapped dependencies yet. Switch environment above,
                or run a sync to discover more of the estate.
              </p>
            </div>
          </div>
        ) : (
          <TopologyCanvas graph={graph} />
        )}
      </div>
    </div>
  );
}
