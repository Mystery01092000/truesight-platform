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
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { ResourceNode } from "./nodes/ResourceNode";
import { GroupNode, type GroupNodeData } from "./nodes/GroupNode";
import { FlowEdge } from "./edges/FlowEdge";
import { FlowField } from "./FlowField";
import {
  TopoFocusContext,
  TopoRevealedContext,
  type TopoFocus,
  type TopoRevealPhase,
} from "./focus";
import { DetailPanel, type Relation } from "./DetailPanel";
import { useExpandCluster } from "./useExpandCluster";
import { kindAccent, type CloudProvider, type EdgeKind } from "@/lib/taxonomy";
import { PROVIDER_LABEL } from "@/components/ui/ProviderChip";
import { cn } from "@/lib/utils/cn";
import type { TopoGraph, TopoNodeData } from "@/lib/topology/types";

const nodeTypes = { resource: ResourceNode, group: GroupNode };
const edgeTypes = { flow: FlowEdge };

/** Minimap node tints — hex mirrors of the accent tokens (SVG fill needs raw color). */
const ACCENT_HEX: Record<string, string> = {
  "accent-blue": "#57c1ff",
  "accent-green": "#59d499",
  "accent-red": "#ff6161",
  "accent-yellow": "#ffc533",
  mute: "#5a5b5c",
};

/** Subtle arrowheads on directional edges, color-matched to FlowEdge's token
 *  strokes (hex because SVG marker fills can't resolve CSS vars reliably). */
const EDGE_MARKER: Partial<Record<EdgeKind, string>> = {
  uses: "#7c8dff", // iris
  "routes-to": "#57c1ff", // info
  "depends-on": "#a4a6ad", // mute
  "deployed-from": "#59d499", // positive
};

/** Height a collapsed account band folds down to (header row + padding). */
const COLLAPSED_BAND_H = 64;

const isProvider = (p: string): p is CloudProvider => p in PROVIDER_LABEL;

function CanvasInner({ graph, ambient }: { graph: TopoGraph; ambient: boolean }) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<TopoRevealPhase>("hidden");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  const { expanded, toggleCluster, memberNodes, memberEdges, memberDataByUrn } =
    useExpandCluster(graph);

  // Entrance choreography driven by the discovery SSE stream — the canvas fades
  // in immediately, nodes hold until the stream's `done` event then stagger in
  // once (≤900ms total), after which the phase settles so viewport-culled nodes
  // remount instantly. Falls back to a fixed timer so the canvas never hangs.
  useEffect(() => {
    if (reduce) {
      setPhase("settled");
      return;
    }

    let done = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      if (done) return;
      done = true;
      setPhase("revealing");
      // Max stagger (450ms) + entrance (250ms) + slack — then go quiet.
      settleTimer = setTimeout(() => setPhase("settled"), 900);
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
      if (settleTimer) clearTimeout(settleTimer);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [reduce, graph.stats.scope]);

  const toggleGroup = useCallback((account: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });
  }, []);

  // Dominant provider per account band (null when the band mixes providers).
  const providerByAccount = useMemo(() => {
    const m = new Map<string, CloudProvider | null>();
    for (const n of graph.nodes) {
      const p = isProvider(n.data.provider) ? n.data.provider : null;
      if (!m.has(n.group)) m.set(n.group, p);
      else if (m.get(n.group) !== p) m.set(n.group, null);
    }
    return m;
  }, [graph.nodes]);

  // Node id → account, for hiding edges attached to a collapsed band.
  const accountOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of graph.nodes) m.set(n.id, n.group);
    for (const [urn, d] of memberDataByUrn) m.set(urn, d.account);
    return m;
  }, [graph.nodes, memberDataByUrn]);

  const rfNodes = useMemo<Node[]>(() => {
    const groupNodes: Node[] = graph.groups.map((g) => {
      const collapsed = collapsedGroups.has(g.account);
      const data: GroupNodeData = {
        label: g.label,
        account: g.account,
        count: graph.stats.accounts.find((a) => a.account === g.account)?.n ?? 0,
        provider: providerByAccount.get(g.account) ?? null,
        collapsed,
        onToggle: () => toggleGroup(g.account),
      };
      return {
        id: g.id,
        type: "group",
        position: g.position,
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: 0,
        data,
        style: { width: g.width, height: collapsed ? COLLAPSED_BAND_H : g.height },
      };
    });
    const resNodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      type: "resource",
      position: n.position,
      data: n.data.isCluster ? { ...n.data, expanded: expanded.has(n.id) } : n.data,
      draggable: false,
      hidden: collapsedGroups.has(n.group),
      zIndex: 1,
    }));
    const members: Node[] = memberNodes.map((n) => ({
      ...n,
      hidden: collapsedGroups.has((n.data as TopoNodeData).account),
    }));
    return [...groupNodes, ...resNodes, ...members];
  }, [graph, collapsedGroups, providerByAccount, toggleGroup, expanded, memberNodes]);

  const rfEdges = useMemo<Edge[]>(() => {
    const hiddenEnd = (id: string) => {
      const acct = accountOf.get(id);
      return acct != null && collapsedGroups.has(acct);
    };
    const graphEdges: Edge[] = graph.edges.map((e) => {
      const marker = EDGE_MARKER[e.kind];
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "flow",
        data: { kind: e.kind },
        hidden: hiddenEnd(e.source) || hiddenEnd(e.target),
        markerEnd: marker
          ? { type: MarkerType.ArrowClosed, width: 14, height: 14, color: marker }
          : undefined,
      };
    });
    const expandEdges: Edge[] = memberEdges.map((e) => ({
      ...e,
      hidden: hiddenEnd(e.source) || hiddenEnd(e.target),
    }));
    return [...graphEdges, ...expandEdges];
  }, [graph.edges, memberEdges, accountOf, collapsedGroups]);

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

  const selectedNode = useMemo<TopoNodeData | null>(() => {
    if (!selected) return null;
    return (
      graph.nodes.find((n) => n.id === selected)?.data ?? memberDataByUrn.get(selected) ?? null
    );
  }, [selected, graph.nodes, memberDataByUrn]);

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

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if (node.type !== "resource") return;
      // Clusters expand/collapse in place; plain resources open the detail sheet.
      if ((node.data as TopoNodeData).isCluster) toggleCluster(node.id);
      else setSelected(node.id);
    },
    [toggleCluster],
  );
  const onPaneClick = useCallback(() => setSelected(null), []);

  return (
    <TopoRevealedContext.Provider value={phase}>
      <TopoFocusContext.Provider value={focus}>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "topo-canvas relative h-full w-full",
            phase !== "hidden" && "topo-revealed",
          )}
        >
          {/* Static ambience — the iris bloom (.topo-canvas::before in globals)
              plus a second faint radial. Zero runtime cost, no rAF at idle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "radial-gradient(55% 42% at 82% 82%, rgba(87, 193, 255, 0.035), transparent 70%)",
            }}
          />
          {/* Opt-in WebGL nebula still — renders ONE frame, no animation loop. */}
          {ambient ? (
            <FlowField
              ambient
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            />
          ) : null}
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
            onlyRenderVisibleElements
            minZoom={0.12}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            className="!bg-transparent"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={26}
              size={1.2}
              color="var(--color-stone)"
            />
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
          </ReactFlow>

          <DetailPanel
            node={selectedNode}
            relations={relations}
            onClose={() => setSelected(null)}
            onSelect={setSelected}
          />
        </motion.div>
      </TopoFocusContext.Provider>
    </TopoRevealedContext.Provider>
  );
}

export function TopologyCanvas({
  graph,
  ambient = false,
  remountKey,
}: {
  graph: TopoGraph;
  /** Opt-in WebGL ambience (single still frame). Default OFF — CSS only. */
  ambient?: boolean;
  /** Extra key material (e.g. layout mode) forcing a remount + refit. */
  remountKey?: string;
}) {
  // Remount per scope/provider (and layout via remountKey) so a switch replays
  // the entrance once and refits the viewport.
  return (
    <ReactFlowProvider>
      <CanvasInner
        key={`${graph.stats.scope}:${graph.stats.provider}:${remountKey ?? ""}`}
        graph={graph}
        ambient={ambient}
      />
    </ReactFlowProvider>
  );
}
