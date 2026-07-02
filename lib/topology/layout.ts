import "server-only";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  NODE_W,
  NODE_H,
  type TopoNode,
  type TopoEdge,
  type TopoGroup,
  type TopoLayoutMode,
} from "./types";

/**
 * Server-side layout engine. Each account is laid out independently with ELK,
 * then the account blocks are stacked into vertical bands with a gap. Running
 * per-account keeps bands from interleaving and yields clean group boxes —
 * accounts have no cross-account edges in practice, and any that appear are
 * still drawn correctly between the positioned bands. Deterministic: ELK is
 * seeded only by node/edge identity and order, so the same estate lays out the
 * same way every render (no client layout jump).
 *
 * Two modes are available:
 *  - `layered` (default): a force-directed (Fruchterman–Reingold) spread. The
 *    estate weave has shallow depth but high breadth, so a strict layered
 *    algorithm collapses into a tall unreadable column. Force spreads nodes in
 *    2D: hubs (a VPC, an ECS cluster) settle at the centre of their satellites.
 *  - `organic`: ELK stress majorization — a "constellation" read where the
 *    graph-theoretic distances are preserved, giving a rounder, more organic
 *    mind-map for exploration.
 */

const elk = new ELK();

const LAYOUT_OPTIONS: Record<TopoLayoutMode, Record<string, string>> = {
  // Force-directed (Fruchterman–Reingold). The default layered-band read.
  layered: {
    "elk.algorithm": "org.eclipse.elk.force",
    "elk.force.model": "FRUCHTERMAN_REINGOLD",
    "elk.force.iterations": "300",
    "elk.spacing.nodeNode": "64",
    "elk.randomSeed": "1",
    "elk.separateConnectedComponents": "true",
    "elk.spacing.componentComponent": "72",
  },
  // Stress majorization — graph-theoretic distance preservation for a
  // constellation mind-map read. Rounder, more organic cluster shapes.
  organic: {
    "elk.algorithm": "org.eclipse.elk.stress",
    "elk.spacing.nodeNode": "72",
    "elk.randomSeed": "1",
    "elk.separateConnectedComponents": "true",
    "elk.spacing.componentComponent": "88",
  },
};

const GROUP_PAD_X = 30;
const GROUP_PAD_TOP = 56; // room for the account header label
const GROUP_PAD_BOTTOM = 30;
const ACCOUNT_GAP = 88;

export async function layoutGraph(
  nodes: TopoNode[],
  edges: TopoEdge[],
  mode: TopoLayoutMode = "layered",
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
      layoutOptions: LAYOUT_OPTIONS[mode],
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

    // Compact the band: ELK's force spread scales its area superlinearly with
    // node count, which pushes fitView below legibility (nodes render at a few
    // px). Scale the block toward a grid-density target so the whole weave
    // stays readable at the initial fit — force still decides the STRUCTURE
    // (hubs central, satellites around), we only tighten the spread.
    const n = Math.max(1, kids.length);
    const cols = Math.ceil(Math.sqrt(n * 1.8));
    const targetW = cols * (NODE_W + 110);
    const targetH = Math.ceil(n / cols) * (NODE_H + 130);
    const rawW = maxX - minX;
    const rawH = maxY - minY;
    const scaleX = rawW > targetW ? targetW / rawW : 1;
    const scaleY = rawH > targetH ? targetH / rawH : 1;
    for (const k of kids) {
      k.x = minX + ((k.x ?? 0) - minX) * scaleX;
      k.y = minY + ((k.y ?? 0) - minY) * scaleY;
    }

    // Recompute bounds after scaling — node dimensions don't scale, so the
    // trailing card can extend past rawW * scaleX.
    let sMaxX = -Infinity;
    let sMaxY = -Infinity;
    for (const k of kids) {
      sMaxX = Math.max(sMaxX, (k.x ?? 0) + (k.width ?? NODE_W));
      sMaxY = Math.max(sMaxY, (k.y ?? 0) + (k.height ?? NODE_H));
    }
    const localW = Number.isFinite(sMaxX) ? sMaxX - minX : NODE_W;
    const localH = Number.isFinite(sMaxY) ? sMaxY - minY : NODE_H;
    const span = Math.max(1, localW);
    const offX = GROUP_PAD_X - minX;
    const offY = cursorY + GROUP_PAD_TOP - minY;

    for (const k of kids) {
      positioned.set(k.id, { x: (k.x ?? 0) + offX, y: (k.y ?? 0) + offY });
    }

    // Entrance cascade: nodes on earlier layers (smaller x) resolve first,
    // each account band staggered slightly after the previous. Capped at 450ms
    // so the whole choreography (canvas fade + node entrances) stays ≤900ms.
    for (const n of accNodes) {
      const p = positioned.get(n.id);
      const normX = p ? Math.min(1, Math.max(0, (p.x - GROUP_PAD_X) / span)) : 0;
      n.data.appearDelay = Math.min(0.45, accountIndex * 0.06 + normX * 0.3);
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

/** Default layered-band layout (Fruchterman–Reingold force spread). */
export async function layeredLayout(
  nodes: TopoNode[],
  edges: TopoEdge[],
): Promise<{ nodes: TopoNode[]; groups: TopoGroup[] }> {
  return layoutGraph(nodes, edges, "layered");
}

/** Organic constellation layout (ELK stress majorization). */
export async function organicLayout(
  nodes: TopoNode[],
  edges: TopoEdge[],
): Promise<{ nodes: TopoNode[]; groups: TopoGroup[] }> {
  return layoutGraph(nodes, edges, "organic");
}
