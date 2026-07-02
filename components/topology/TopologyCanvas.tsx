"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ResourceNode } from "./nodes/ResourceNode";
import { GroupNode } from "./nodes/GroupNode";
import { FlowEdge } from "./edges/FlowEdge";
import { FlowField } from "./FlowField";
import { TopoFocusContext, type TopoFocus } from "./focus";
import { DetailPanel, type Relation } from "./DetailPanel";
import { Legend } from "./Legend";
import { kindAccent, type EdgeKind } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";
import type { TopoGraph, TopoNodeData } from "@/lib/topology/types";

const nodeTypes = { resource: ResourceNode, group: GroupNode };
const edgeTypes = { flow: FlowEdge };

const ACCENT_HEX: Record<string, string> = {
  "accent-blue": "#57c1ff",
  "accent-green": "#59d499",
  "accent-red": "#ff6161",
  "accent-yellow": "#ffc533",
  mute: "#5a5b5c",
};

/** Arrowhead markers for directional edges. Color matches the edge stroke so
 *  directionality reads without competing with the flowing data packets. */
const ARROW_MARKER: Partial<Record<EdgeKind, { color: string }>> = {
  "deployed-from": { color: "#6fe5b0" },
  "depends-on": { color: "#9c9c9d" },
};

function CanvasInner({ graph }: { graph: TopoGraph }) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [pulseRings, setPulseRings] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Entrance choreography driven by the discovery SSE stream — the aperture
  // "watches" as each stage resolves, then the weave reveals. Falls back to a
  // fixed timer if the stream is unavailable so the canvas never hangs.
  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }

    let settled = false;
    const reveal = () => {
      if (settled) return;
      settled = true;
      setRevealed(true);
      // After the nodes settle, pulse the drift rings once — the "no blind
      // spots" halo announces itself, then goes quiet.
      const pulse = setTimeout(() => {
        setPulseRings(true);
        const clear = setTimeout(() => setPulseRings(false), 1100);
        return () => clearTimeout(clear);
      }, 900);
      return () => clearTimeout(pulse);
    };

    // Timer fallback — fires if the SSE stream never sends a `done` event.
    const fallback = setTimeout(reveal, 2400);

    try {
      const es = new EventSource(`/api/topology/stream?env=${graph.stats.scope}`);
      sseRef.current = es;
      es.addEventListener("done", () => {
        reveal();
        es.close();
      });
      es.addEventListener("error", () => {
        // Stream dropped or unavailable — let the timer fallback handle it.
        es.close();
      });
    } catch {
      // EventSource unsupported — the timer fallback handles reveal.
    }

    return () => {
      clearTimeout(fallback);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [reduce, graph.stats.scope]);

  const rfNodes = useMemo<Node[]>(() => {
    const groupNodes: Node[] = graph.groups.map((g) => ({
      id: g.id,
      type: "group",
      position: g.position,
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
      data: {
        label: g.label,
        account: g.account,
        count: graph.stats.accounts.find((a) => a.account === g.account)?.n ?? 0,
      },
      style: { width: g.width, height: g.height },
    }));
    const resNodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      type: "resource",
      position: n.position,
      data: n.data,
      draggable: false,
      zIndex: 1,
    }));
    return [...groupNodes, ...resNodes];
  }, [graph]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const marker = ARROW_MARKER[e.kind];
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "flow",
          data: { kind: e.kind },
          markerEnd: marker
            ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: marker.color }
            : undefined,
        };
      }),
    [graph],
  );

  const focus = useMemo<TopoFocus>(() => {
    if (!selected) return { selected: null, neighbors: new Set(), edges: new Set() };
    const neighbors = new Set<string>();
    const edges = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === selected) {
        neighbors.add(e.target);
        edges.add(e.id);
      } else if (e.target === selected) {
        neighbors.add(e.source);
        edges.add(e.id);
      }
    }
    return { selected, neighbors, edges };
  }, [selected, graph.edges]);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selected)?.data ?? null,
    [selected, graph.nodes],
  );

  const relations = useMemo<Relation[]>(() => {
    if (!selected) return [];
    const byUrn = new Map(graph.nodes.map((n) => [n.id, n.data]));
    const rels: Relation[] = [];
    for (const e of graph.edges) {
      if (e.source === selected) {
        const d = byUrn.get(e.target);
        if (d) rels.push({ data: d, kind: e.kind, direction: "out" });
      } else if (e.target === selected) {
        const d = byUrn.get(e.source);
        if (d) rels.push({ data: d, kind: e.kind, direction: "in" });
      }
    }
    return rels;
  }, [selected, graph.nodes, graph.edges]);

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    if (node.type === "resource") setSelected(node.id);
  }, []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  return (
    <TopoFocusContext.Provider value={focus}>
      <div
        className={cn(
          "topo-canvas relative h-full w-full",
          revealed && "topo-revealed",
          pulseRings && "topo-pulse",
        )}
      >
        {/* WebGL data-nebula — cinematic depth behind the weave */}
        <FlowField className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.12}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1.1 }}
          className="!bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#212327" />
          <Controls showInteractive={false} className="topo-controls" position="bottom-right" />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={0}
            bgColor="#0b0c0d"
            maskColor="rgba(7,8,10,0.66)"
            maskStrokeColor="#2a2d2e"
            maskStrokeWidth={2}
            className="topo-minimap"
            nodeColor={(n) =>
              n.type === "group"
                ? "transparent"
                : ACCENT_HEX[kindAccent[(n.data as TopoNodeData).kind] ?? "mute"]
            }
          />
          <Panel position="top-left">
            <Legend />
          </Panel>
        </ReactFlow>

        {/* Scanning sweep — the aperture "watching" state, replayed once per scope. */}
        <AnimatePresence>
          {!revealed && !reduce ? (
            <motion.div
              key="scan"
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                initial={{ x: "-25%" }}
                animate={{ x: "125%" }}
                transition={{ duration: 1.05, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-y-0 w-1/3"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(87,193,255,0.05) 55%, rgba(87,193,255,0.13))",
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {selectedNode ? (
            <DetailPanel
              node={selectedNode}
              relations={relations}
              onClose={() => setSelected(null)}
              onSelect={setSelected}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </TopoFocusContext.Provider>
  );
}

export function TopologyCanvas({ graph }: { graph: TopoGraph }) {
  // Remount per scope so a scope switch replays the entrance and refits the view.
  return (
    <ReactFlowProvider>
      <CanvasInner key={graph.stats.scope} graph={graph} />
    </ReactFlowProvider>
  );
}
