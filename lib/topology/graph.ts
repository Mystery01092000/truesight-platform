import "server-only";
import { sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { integrationAccounts, resourceEdges, driftFindings } from "@/db/schema";
import { COST_SOURCE_EXTERNAL_IDS } from "@/lib/integrations/cost-sources";
import {
  RESOURCE_KINDS,
  type ResourceKind,
  type ResourceStatus,
  type EdgeKind,
  type DriftStatus,
} from "@/lib/taxonomy";
import { cacheable } from "@/lib/cache";
import { clusterGraph } from "./cluster";
import { layoutGraph } from "./layout";
import { topologyContentHash } from "./hash";
import type {
  TopoEnvScope,
  TopoLayoutMode,
  TopoProvider,
  TopoNode,
  TopoEdge,
  TopoGraph,
  TopoGroup,
  TopoStats,
  TopoCoverage,
} from "./types";
import { TOPO_PROVIDERS } from "./types";

/**
 * Server-side topology graph builder. Reads the real `resources` + `resource_edges`
 * KB (populated by the AWS sync), scopes it to an environment, and hands the raw
 * node/edge set to the ELK layout engine. The canvas only ever renders the
 * CONNECTED weave (nodes that participate in an edge) — isolated inventory lives
 * in the estate explorer. Environment scoping uses edge-closure: we seed on the
 * scoped nodes then pull in every node one hop away, so a scoped workload always
 * shows its full immediate dependency neighborhood with no dangling edges.
 */

type NodeRow = {
  urn: string;
  provider: string;
  account: string | null;
  region: string | null;
  service: string | null;
  type: string | null;
  name: string | null;
  environment: string | null;
  status: string | null;
  native_type: string | null;
};

const KNOWN_ACCOUNT_LABELS: Record<string, string> = {
  "664224997032": "Management",
  "404063516552": "Production",
  "778056636823": "Development",
};

const KIND_SET = new Set<string>(RESOURCE_KINDS);
const asKind = (t: string | null): ResourceKind =>
  t && KIND_SET.has(t) ? (t as ResourceKind) : "unknown";
const asStatus = (s: string | null): ResourceStatus =>
  s === "healthy" || s === "degraded" || s === "stopped" ? s : "unknown";

/**
 * Resolve the latest Terraform drift classification per URN from the
 * `drift_findings` KB. Returns a URN → status map so the topology can render
 * the real "no blind spots" halo on every node. Falls back to `unknown` when no
 * finding exists — the canvas reads clean until the drift engine has spoken.
 */
async function loadDriftByUrn(
  urns: string[],
): Promise<Map<string, DriftStatus>> {
  if (urns.length === 0) return new Map();
  const rows = await db
    .select({
      urn: driftFindings.urn,
      classification: driftFindings.classification,
    })
    .from(driftFindings)
    .where(inArray(driftFindings.urn, urns))
    .orderBy(desc(driftFindings.detectedAt));
  const latest = new Map<string, DriftStatus>();
  for (const r of rows) {
    if (!latest.has(r.urn)) latest.set(r.urn, r.classification);
  }
  return latest;
}

export async function getTopology(
  scope: TopoEnvScope,
  layout: TopoLayoutMode = "layered",
  provider: TopoProvider = "all",
): Promise<TopoGraph> {
  const scopeAll = scope === "all";
  const providerAll = provider === "all";
  const like = `${scope}%`;

  const accountRows = await db.select().from(integrationAccounts);
  const labelFor = (account: string | null): string => {
    if (!account) return "Unknown account";
    const row = accountRows.find((a) => a.externalId === account);
    return row?.displayName ?? KNOWN_ACCOUNT_LABELS[account] ?? account;
  };

  const nodeRows = (await db.execute(sql`
    with connected as (
      select source_urn as urn from resource_edges
      union
      select target_urn as urn from resource_edges
    ),
    seed as (
      select c.urn
      from connected c
      join resources r on r.urn = c.urn and r.present = true
      where ${scopeAll ? sql`true` : sql`lower(coalesce(r.environment, '')) like ${like}`}
        and ${providerAll ? sql`true` : sql`r.provider = ${provider}`}
    ),
    rel_edges as (
      select e.source_urn, e.target_urn
      from resource_edges e
      where e.source_urn in (select urn from seed)
         or e.target_urn in (select urn from seed)
    ),
    node_urns as (
      select urn from seed
      union select source_urn from rel_edges
      union select target_urn from rel_edges
    )
    select r.urn, r.provider, r.account, r.region, r.service, r.type, r.name,
           r.environment, r.status, r.attributes->>'nativeType' as native_type
    from resources r
    where r.urn in (select urn from node_urns) and r.present = true
  `)) as unknown as NodeRow[];

  const nodeUrns = new Set(nodeRows.map((n) => n.urn));

  // Resolve the latest Terraform drift classification for every resource in the
  // weave — the signature "no blind spots" halo is driven from real findings.
  const driftByUrn = await loadDriftByUrn([...nodeUrns]);

  // All edges whose BOTH endpoints are in-scope — guarantees a fully-woven graph
  // with no half-drawn dependencies. 428 edges total, so an in-memory filter.
  const allEdges = await db.select().from(resourceEdges);
  const edges: TopoEdge[] = allEdges
    .filter((e) => nodeUrns.has(e.sourceUrn) && nodeUrns.has(e.targetUrn))
    .map((e) => ({
      id: e.id,
      source: e.sourceUrn,
      target: e.targetUrn,
      kind: e.kind as EdgeKind,
    }));

  const nodes: TopoNode[] = nodeRows.map((r) => {
    const kind = asKind(r.type);
    const account = r.account ?? "unknown";
    return {
      id: r.urn,
      group: account,
      position: { x: 0, y: 0 },
      width: 0,
      height: 0,
      data: {
        urn: r.urn,
        name: r.name ?? r.urn.split(":").pop() ?? r.urn,
        kind,
        service: r.service ?? "—",
        provider: r.provider,
        account,
        accountLabel: labelFor(r.account),
        region: r.region,
        environment: r.environment,
        status: asStatus(r.status),
        drift: driftByUrn.get(r.urn) ?? "unknown",
        nativeType: r.native_type,
        appearDelay: 0,
      },
    };
  });

  // Collapse low-signal fan-out (same-kind structural leaves) into cluster nodes
  // for a mind-map-clean canvas, then lay out. The cluster+layout pass is pure
  // in graph identity (URNs + edge triples + mode + scope + provider), so its
  // output is cached under a content hash — the per-request ELK cost is paid
  // once per estate shape. The sync orchestrator busts the `topology:` prefix,
  // so a re-discovered estate re-lays-out on the next request.
  const layoutKey = topologyContentHash({
    urns: nodeUrns,
    edges,
    mode: layout,
    scope,
    provider,
  });
  let cacheHit = true;
  const t0 = Date.now();
  // v2 = 264×84 node box; bump when node geometry changes so a persisted
  // (Redis) cache never serves layouts computed for the old card size.
  const laid = await cacheable<{
    nodes: TopoNode[];
    groups: TopoGroup[];
    edges: TopoEdge[];
  }>(`topology:layout:v2:${layoutKey}`, 3600, async () => {
    cacheHit = false;
    const clustered = clusterGraph({
      nodes,
      edges,
      groups: [],
      stats: {
        scope,
        provider,
        nodes: nodes.length,
        edges: edges.length,
        accounts: [],
        byKind: [],
        coverage: [],
        drifted: 0,
      },
    });
    const { nodes: laidOut, groups } = await layoutGraph(
      clustered.nodes,
      clustered.edges,
      layout,
    );
    return { nodes: laidOut, groups, edges: clustered.edges };
  });
  console.debug(
    `[topology] layout cache ${cacheHit ? "hit" : "miss"} key=${layoutKey} scope=${scope} provider=${provider} mode=${layout} in ${Date.now() - t0}ms`,
  );

  // The cache stores geometry keyed by graph IDENTITY — mutable per-node fields
  // (status, drift) are refreshed from this request's rows so a cache hit never
  // serves stale health while positions stay stable.
  const liveByUrn = new Map(
    nodeRows.map((r) => [
      r.urn,
      { status: asStatus(r.status), drift: driftByUrn.get(r.urn) ?? ("unknown" as DriftStatus) },
    ]),
  );
  const finalNodes: TopoNode[] = laid.nodes.map((n) => {
    if (n.data.isCluster) {
      // Cluster summaries render neutral themselves, but their member payloads
      // (expanded client-side) carry status/drift — refresh those too so an
      // expanded cluster never shows cached health.
      const members = n.data.clusterMemberNodes;
      if (!members) return n;
      return {
        ...n,
        data: {
          ...n.data,
          clusterMemberNodes: members.map((m) => {
            const live = liveByUrn.get(m.urn);
            return live ? { ...m, status: live.status, drift: live.drift } : m;
          }),
        },
      };
    }
    const live = liveByUrn.get(n.id);
    return live ? { ...n, data: { ...n.data, status: live.status, drift: live.drift } } : n;
  });

  const kindCounts = new Map<ResourceKind, number>();
  for (const n of finalNodes) kindCounts.set(n.data.kind, (kindCounts.get(n.data.kind) ?? 0) + 1);
  const byKind = [...kindCounts.entries()]
    .map(([kind, n]) => ({ kind, n }))
    .sort((a, b) => b.n - a.n);

  const acctCounts = new Map<string, number>();
  for (const n of finalNodes) acctCounts.set(n.data.account, (acctCounts.get(n.data.account) ?? 0) + 1);
  const accounts = [...acctCounts.entries()]
    .map(([account, n]) => ({ account, label: labelFor(account), n }))
    .sort((a, b) => b.n - a.n);

  // Per-provider scope-context read for the canvas legend: a single present
  // account keeps its display name ("Azure · Production"); full coverage of the
  // registered integration accounts reads "All accounts"; anything partial
  // falls back to an honest count. Never hardcoded — derived from the weave.
  const coverage: TopoCoverage[] = TOPO_PROVIDERS.filter(
    (p): p is TopoCoverage["provider"] => p !== "all",
  ).flatMap((p) => {
    const present = new Set(
      finalNodes.filter((n) => n.data.provider === p).map((n) => n.data.account),
    );
    if (present.size === 0) return [];
    const registered = accountRows.filter(
      (a) =>
        a.provider === p &&
        a.enabled &&
        // Cost-source registry rows never carry resources — not coverage targets.
        !COST_SOURCE_EXTERNAL_IDS.includes(a.externalId),
    );
    const label =
      present.size === 1
        ? labelFor([...present][0] ?? null)
        : registered.length > 0 && registered.every((a) => present.has(a.externalId))
          ? "All accounts"
          : `${present.size} accounts`;
    return [{ provider: p, label }];
  });

  const stats: TopoStats = {
    scope,
    provider,
    nodes: finalNodes.length,
    edges: laid.edges.length,
    accounts,
    byKind,
    coverage,
    drifted: finalNodes.filter((n) => n.data.drift !== "in_sync" && n.data.drift !== "unknown").length,
  };

  return { nodes: finalNodes, groups: laid.groups, edges: laid.edges, stats };
}
