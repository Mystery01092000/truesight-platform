import type { Edge, Node } from "@xyflow/react";
import { getService } from "@/lib/forge/catalog";
import type { ForgeCanvas, ForgeNode } from "@/lib/forge/types";

/** Data payload carried by every Forge flow node. */
export interface ForgeNodeData extends Record<string, unknown> {
  forge: ForgeNode;
  serviceLabel: string;
  provider: "aws" | "azure";
  isContainer: boolean;
  errors: string[];
}

export type ForgeFlowNode = Node<ForgeNodeData>;

export const DEFAULT_CONTAINER = { width: 420, height: 280 };

/** Depth of a node in the containment tree (parents must precede children). */
function depth(byId: Map<string, ForgeNode>, node: ForgeNode): number {
  let d = 0;
  let cur = node.parentId;
  while (cur) {
    d++;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return d;
}

export function toFlow(
  canvas: ForgeCanvas,
  issues: Map<string, string[]> = new Map(),
): { nodes: ForgeFlowNode[]; edges: Edge[] } {
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  const ordered = [...canvas.nodes].sort((a, b) => depth(byId, a) - depth(byId, b));
  const nodes = ordered.map((n) => {
    const svc = getService(n.serviceId);
    const isContainer = svc?.isContainer ?? false;
    return {
      id: n.id,
      type: isContainer ? "container" : "service",
      position: n.position,
      ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {}),
      ...(isContainer
        ? {
            style: {
              width: n.size?.width ?? DEFAULT_CONTAINER.width,
              height: n.size?.height ?? DEFAULT_CONTAINER.height,
            },
          }
        : {}),
      data: {
        forge: n,
        serviceLabel: svc?.label ?? n.serviceId,
        provider: svc?.provider ?? "aws",
        isContainer,
        errors: issues.get(n.id) ?? [],
      },
    } satisfies ForgeFlowNode;
  });
  const edges: Edge[] = canvas.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes, edges };
}

export function fromFlow(nodes: ForgeFlowNode[], edges: Edge[]): ForgeCanvas {
  return {
    nodes: nodes.map((n) => {
      const base: ForgeNode = {
        ...n.data.forge,
        id: n.id,
        parentId: n.parentId ?? null,
        position: n.position,
      };
      if (n.data.isContainer) {
        const width = Number(n.style?.width ?? n.width ?? DEFAULT_CONTAINER.width);
        const height = Number(n.style?.height ?? n.height ?? DEFAULT_CONTAINER.height);
        return { ...base, size: { width, height } };
      }
      const { size: _size, ...rest } = base;
      return rest;
    }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

/** Absolute canvas position of a node (its position is relative to its parent). */
export function absolutePosition(nodes: ForgeFlowNode[], id: string): { x: number; y: number } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur = byId.get(id);
  let x = 0;
  let y = 0;
  while (cur) {
    x += cur.position.x;
    y += cur.position.y;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return { x, y };
}

/** True when `maybeAncestorId` is an ancestor of (or equals) `nodeId`. */
export function isAncestorOrSelf(nodes: ForgeFlowNode[], nodeId: string, maybeAncestorId: string): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur: string | undefined | null = nodeId;
  while (cur) {
    if (cur === maybeAncestorId) return true;
    cur = byId.get(cur)?.parentId;
  }
  return false;
}
