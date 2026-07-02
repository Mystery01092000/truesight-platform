import "server-only";
import { sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { integrationAccounts, resourceEdges, driftFindings } from "@/db/schema";
import {
  RESOURCE_KINDS,
  type ResourceKind,
  type ResourceStatus,
  type EdgeKind,
  type DriftStatus,
} from "@/lib/taxonomy";
import { clusterGraph } from "./cluster";
import { layoutGraph } from "./layout";
import type {
  TopoEnvScope,
  TopoLayoutMode,
  TopoNode,
  TopoEdge,
  TopoGraph,
  TopoStats,
} from "./types";

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
): Promise<TopoGraph> {
  const scopeAll = scope === "all";
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
  // for a mind-map-clean canvas, then lay out and derive stats from what is
  // actually rendered (header ↔ canvas stay consistent; the cluster nodes
  // themselves state the collapsed counts).
  const clustered = clusterGraph({
    nodes,
    edges,
    groups: [],
    stats: {
      scope,
      nodes: nodes.length,
      edges: edges.length,
      accounts: [],
      byKind: [],
      drifted: 0,
    },
  });
  const { nodes: laidOut, groups } = await layoutGraph(
    clustered.nodes,
    clustered.edges,
    layout,
  );

  const kindCounts = new Map<ResourceKind, number>();
  for (const n of clustered.nodes) kindCounts.set(n.data.kind, (kindCounts.get(n.data.kind) ?? 0) + 1);
  const byKind = [...kindCounts.entries()]
    .map(([kind, n]) => ({ kind, n }))
    .sort((a, b) => b.n - a.n);

  const acctCounts = new Map<string, number>();
  for (const n of clustered.nodes) acctCounts.set(n.data.account, (acctCounts.get(n.data.account) ?? 0) + 1);
  const accounts = [...acctCounts.entries()]
    .map(([account, n]) => ({ account, label: labelFor(account), n }))
    .sort((a, b) => b.n - a.n);

  const stats: TopoStats = {
    scope,
    nodes: clustered.nodes.length,
    edges: clustered.edges.length,
    accounts,
    byKind,
    drifted: clustered.nodes.filter((n) => n.data.drift !== "in_sync" && n.data.drift !== "unknown").length,
  };

  return { nodes: laidOut, groups, edges: clustered.edges, stats };
}
