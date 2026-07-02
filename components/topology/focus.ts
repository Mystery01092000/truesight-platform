"use client";

import { createContext } from "react";

/**
 * Selection focus shared across the canvas. When a node is selected we highlight
 * it, its immediate neighbours and the edges between them, and dim everything
 * else — "the eye narrows onto a node". Passing this via context (rather than
 * mutating the node/edge arrays) means selecting never triggers a re-layout;
 * only the consuming nodes/edges re-render.
 */
export type TopoFocus = {
  selected: string | null;
  neighbors: Set<string>;
  edges: Set<string>;
};

export const TopoFocusContext = createContext<TopoFocus>({
  selected: null,
  neighbors: new Set(),
  edges: new Set(),
});

/**
 * Entrance gate. Nodes hold at opacity 0 (`hidden`) until the discovery SSE
 * stream emits `done` (or the fallback timer fires), then stagger in once
 * (`revealing`). After the choreography resolves the canvas flips to `settled`
 * so nodes remounted later (onlyRenderVisibleElements re-mounts on pan/zoom)
 * enter instantly instead of replaying the staggered entrance. Defaults to
 * `settled` so nodes render immediately outside the canvas provider.
 */
export type TopoRevealPhase = "hidden" | "revealing" | "settled";

export const TopoRevealedContext = createContext<TopoRevealPhase>("settled");
