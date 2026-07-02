"use client";

import { useCallback, useMemo, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { NODE_W, NODE_H, type TopoGraph, type TopoNodeData } from "@/lib/topology/types";

/**
 * Progressive disclosure for cluster summary nodes. Clicking a cluster expands
 * its collapsed members in place — a client-side grid materialized around the
 * cluster's position from the `clusterMemberNodes` payload the server shipped
 * with the summary node (no round-trip). Each member enters with a 250ms
 * scale/fade (staggered ≤40ms via `appearDelay`, handled by ResourceNode), and
 * a `contains` hairline ties it back to its cluster. Clicking again collapses
 * and restores the summary card.
 */

const GRID_GAP_X = 28;
const GRID_GAP_Y = 22;
/** Vertical clearance between the cluster card and the first member row. */
const GRID_OFFSET_Y = 48;

export function useExpandCluster(graph: TopoGraph): {
  expanded: ReadonlySet<string>;
  toggleCluster: (clusterId: string) => void;
  memberNodes: Node[];
  memberEdges: Edge[];
  memberDataByUrn: ReadonlyMap<string, TopoNodeData>;
} {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggleCluster = useCallback((clusterId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  }, []);

  const { memberNodes, memberEdges, memberDataByUrn } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const byUrn = new Map<string, TopoNodeData>();

    for (const clusterId of expanded) {
      const cluster = graph.nodes.find((n) => n.id === clusterId);
      const members = cluster?.data.clusterMemberNodes ?? [];
      if (!cluster || members.length === 0) continue;

      const cols = Math.max(2, Math.ceil(Math.sqrt(members.length)));
      members.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const data: TopoNodeData = {
          ...m,
          appearDelay: Math.min(0.28, i * 0.035),
          isClusterMember: true,
        };
        byUrn.set(m.urn, data);
        nodes.push({
          id: m.urn,
          type: "resource",
          position: {
            x: cluster.position.x + (col - (cols - 1) / 2) * (NODE_W + GRID_GAP_X),
            y: cluster.position.y + NODE_H + GRID_OFFSET_Y + row * (NODE_H + GRID_GAP_Y),
          },
          data,
          draggable: false,
          zIndex: 3,
        });
        edges.push({
          id: `expand:${clusterId}:${m.urn}`,
          source: clusterId,
          target: m.urn,
          type: "flow",
          data: { kind: "contains" },
        });
      });
    }

    return { memberNodes: nodes, memberEdges: edges, memberDataByUrn: byUrn };
  }, [expanded, graph.nodes]);

  return { expanded, toggleCluster, memberNodes, memberEdges, memberDataByUrn };
}
