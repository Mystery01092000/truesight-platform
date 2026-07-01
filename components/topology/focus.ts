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
