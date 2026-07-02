import "server-only";
import type { ResourceKind } from "@/lib/taxonomy";
import type { TopoGraph, TopoNode, TopoEdge } from "./types";

/**
 * Low-signal fan-out clustering. A container (VPC, ECS cluster, resource group)
 * often `contains` a dozen or more children of the same kind — subnets, security
 * groups, IAM policies — that carry no dependency signal of their own. Left
 * standing they turn the hero weave into a hairball. This pass folds same-kind
 * fan-out ≥ {@link CLUSTER_THRESHOLD} into a single summary node per
 * (parent × kind), so only the workload weave (the `uses` / `deployed-from`
 * lineage) stays first-class. Children that also participate in a non-`contains`
 * edge are promoted out of the cluster — a subnet a workload actually `uses`
 * remains visible. Pure structural leaves collapse; the dependency graph reads.
 */

/** Minimum same-kind children under one parent before they collapse into a
 *  cluster. 11 = groups only cluster when they have MORE than 10 members;
 *  anything smaller reads fine as individual cards. */
const CLUSTER_THRESHOLD = 11;

const pushInto = (m: Map<string, string[]>, k: string, v: string) => {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
};

/**
 * Collapse same-kind `contains` fan-out into cluster nodes. Takes the raw
 * post-build graph and returns a new graph with the structural noise folded
 * away. Safe to call before the layout pass — positions on the returned cluster
 * nodes are zeroed and filled by the layout engine.
 */
export function clusterGraph(graph: TopoGraph): TopoGraph {
  const { nodes, edges } = graph;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // A node is "externally connected" if it participates in any non-`contains`
  // edge (a `uses`, `depends-on`, `deployed-from`, or `routes-to`). These stay
  // first-class — promoted out of the cluster — so the dependency weave reads.
  const externallyConnected = new Set<string>();
  for (const e of edges) {
    if (e.kind !== "contains") {
      externallyConnected.add(e.source);
      externallyConnected.add(e.target);
    }
  }

  // A node that itself `contains` others is a container — never collapse a
  // container, even if it is purely structural (it anchors a sub-tree).
  const isContainer = new Set<string>();
  for (const e of edges) {
    if (e.kind === "contains") isContainer.add(e.source);
  }

  // Bucket collapsible children by (parent × kind). Only leaf children that are
  // neither externally connected nor containers themselves are candidates.
  const parentKindChildren = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind !== "contains") continue;
    if (externallyConnected.has(e.target)) continue;
    if (isContainer.has(e.target)) continue;
    const child = byId.get(e.target);
    if (!child) continue;
    pushInto(parentKindChildren, `${e.source}\0${child.data.kind}`, e.target);
  }

  // Build cluster nodes for groups that meet the threshold.
  const removed = new Set<string>();
  const childToCluster = new Map<string, string>();
  const clusterNodes: TopoNode[] = [];

  for (const [key, childIds] of parentKindChildren) {
    if (childIds.length < CLUSTER_THRESHOLD) continue;
    const [parentId, kindStr] = key.split("\0");
    const kind = kindStr as ResourceKind;
    const parent = byId.get(parentId);
    if (!parent) continue;

    const clusterId = `cluster:${parentId}:${kind}`;
    for (const cid of childIds) {
      removed.add(cid);
      childToCluster.set(cid, clusterId);
    }

    clusterNodes.push({
      id: clusterId,
      group: parent.group,
      position: { x: 0, y: 0 },
      width: 0,
      height: 0,
      data: {
        urn: clusterId,
        name: `${childIds.length} ${kind} resources`,
        kind,
        service: parent.data.service,
        provider: parent.data.provider,
        account: parent.data.account,
        accountLabel: parent.data.accountLabel,
        region: parent.data.region,
        environment: parent.data.environment,
        status: "unknown",
        drift: "unknown",
        nativeType: null,
        appearDelay: 0,
        isCluster: true,
        clusterCount: childIds.length,
        clusterMembers: childIds.map((c) => byId.get(c)?.data.name ?? c).sort(),
        // Full member payloads ride along so the client can expand the cluster
        // in place (progressive disclosure) without another server round-trip.
        clusterMemberNodes: childIds
          .map((c) => byId.get(c)?.data)
          .filter((d): d is NonNullable<typeof d> => d != null)
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    });
  }

  // Nothing to collapse — return the graph untouched.
  if (clusterNodes.length === 0) return graph;

  // Re-point every edge: endpoints that were removed are redirected to their
  // cluster. Self-loops and duplicates (multiple children → one cluster, all
  // sharing the same `parent →contains→ cluster` re-point) are collapsed.
  const repointed: TopoEdge[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    let source = e.source;
    let target = e.target;
    if (childToCluster.has(source)) source = childToCluster.get(source)!;
    if (childToCluster.has(target)) target = childToCluster.get(target)!;
    if (source === target) continue;
    const dedupeKey = `${source}\0${target}\0${e.kind}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    repointed.push({ id: dedupeKey, source, target, kind: e.kind });
  }

  const keptNodes = nodes.filter((n) => !removed.has(n.id));

  return {
    ...graph,
    nodes: [...keptNodes, ...clusterNodes],
    edges: repointed,
  };
}
