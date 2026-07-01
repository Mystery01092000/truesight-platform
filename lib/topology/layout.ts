import "server-only";
import ELK from "elkjs/lib/elk.bundled.js";
import { NODE_W, NODE_H, type TopoNode, type TopoEdge, type TopoGroup } from "./types";

/**
 * Server-side layout engine. Each account is laid out independently with ELK's
 * layered algorithm (LEFT → RIGHT, so `contains`/`depends-on`/`uses` read as a
 * flow from networking on the left to workloads and their image lineage on the
 * right), then the account blocks are stacked into vertical bands with a gap.
 * Running per-account keeps bands from interleaving and yields clean group boxes
 * — accounts have no cross-account edges in practice, and any that appear are
 * still drawn correctly between the positioned bands. Deterministic: ELK is
 * seeded only by node/edge identity and order, so the same estate lays out the
 * same way every render (no client layout jump).
 */

const elk = new ELK();

const LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  // Generous horizontal gap so the weave reads as a left→right flow; tighter
  // vertical stacking so wide sibling fans (a VPC's subnets) stay compact.
  "elk.layered.spacing.nodeNodeBetweenLayers": "128",
  "elk.spacing.nodeNode": "18",
  "elk.layered.spacing.edgeNodeBetweenLayers": "34",
  // NETWORK_SIMPLEX balances layers vertically for an even, mind-map-like spread.
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  // Fold very long single layers so no band becomes a tall thin column.
  "elk.layered.wrapping.strategy": "MULTI_EDGE",
  "elk.aspectRatio": "1.7",
  "elk.separateConnectedComponents": "true",
  "elk.spacing.componentComponent": "40",
};

const GROUP_PAD_X = 30;
const GROUP_PAD_TOP = 56; // room for the account header label
const GROUP_PAD_BOTTOM = 30;
const ACCOUNT_GAP = 88;

export async function layoutGraph(
  nodes: TopoNode[],
  edges: TopoEdge[],
): Promise<{ nodes: TopoNode[]; groups: TopoGroup[] }> {
  // Bucket nodes by account, largest band first for a stable top-down order.
  const byAccount = new Map<string, TopoNode[]>();
  for (const n of nodes) {
    const arr = byAccount.get(n.group);
    if (arr) arr.push(n);
    else byAccount.set(n.group, [n]);
  }
  const accountOrder = [...byAccount.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  const positioned = new Map<string, { x: number; y: number }>();
  const groups: TopoGroup[] = [];
  let cursorY = 0;

  for (let accountIndex = 0; accountIndex < accountOrder.length; accountIndex++) {
    const [account, accNodes] = accountOrder[accountIndex];
    const idset = new Set(accNodes.map((n) => n.id));
    const accEdges = edges.filter((e) => idset.has(e.source) && idset.has(e.target));

    const res = await elk.layout({
      id: `acc-${account}`,
      layoutOptions: LAYOUT_OPTIONS,
      children: accNodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      edges: accEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    });
    const kids = res.children ?? [];

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const k of kids) {
      const kx = k.x ?? 0;
      const ky = k.y ?? 0;
      minX = Math.min(minX, kx);
      minY = Math.min(minY, ky);
      maxX = Math.max(maxX, kx + (k.width ?? NODE_W));
      maxY = Math.max(maxY, ky + (k.height ?? NODE_H));
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = NODE_W;
      maxY = NODE_H;
    }

    const localW = maxX - minX;
    const localH = maxY - minY;
    const span = Math.max(1, localW);
    const offX = GROUP_PAD_X - minX;
    const offY = cursorY + GROUP_PAD_TOP - minY;

    for (const k of kids) {
      positioned.set(k.id, { x: (k.x ?? 0) + offX, y: (k.y ?? 0) + offY });
    }

    // Entrance cascade: nodes on earlier layers (smaller x) resolve first,
    // each account band staggered slightly after the previous.
    for (const n of accNodes) {
      const p = positioned.get(n.id);
      const normX = p ? Math.min(1, Math.max(0, (p.x - GROUP_PAD_X) / span)) : 0;
      n.data.appearDelay = accountIndex * 0.12 + normX * 0.5;
    }

    groups.push({
      id: `group-${account}`,
      label: accNodes[0]?.data.accountLabel ?? account,
      account,
      position: { x: 0, y: cursorY },
      width: localW + GROUP_PAD_X * 2,
      height: localH + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
    });

    cursorY += localH + GROUP_PAD_TOP + GROUP_PAD_BOTTOM + ACCOUNT_GAP;
  }

  const laidOut = nodes.map((n) => ({
    ...n,
    width: NODE_W,
    height: NODE_H,
    position: positioned.get(n.id) ?? { x: 0, y: 0 },
  }));

  return { nodes: laidOut, groups };
}
