"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { ArrowLeft, Hammer, Play, Rocket, Save, Trash2 } from "lucide-react";

import { getService, type ForgeService } from "@/lib/forge/catalog";
import type { ForgeCanvas, ForgeValidationIssue } from "@/lib/forge/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  absolutePosition,
  fromFlow,
  isAncestorOrSelf,
  toFlow,
  DEFAULT_CONTAINER,
  type ForgeFlowNode,
} from "./flow";
import { Palette, FORGE_DND_MIME } from "./Palette";
import { Inspector } from "./Inspector";
import { ServiceNode } from "./nodes/ServiceNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { TfPreview } from "./TfPreview";
import { RunDrawer } from "./RunDrawer";
import { ConfirmDialog } from "./ConfirmDialog";

const nodeTypes = { service: ServiceNode, container: ContainerNode };

export interface ForgeStudioProps {
  plan: {
    id: string;
    name: string;
    status: string;
    canvasJson: ForgeCanvas;
  };
  canWrite: boolean;
  canDeploy: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ForgeStudio(props: ForgeStudioProps) {
  return (
    <ReactFlowProvider>
      <StudioInner {...props} />
    </ReactFlowProvider>
  );
}

function StudioInner({ plan, canWrite, canDeploy }: ForgeStudioProps) {
  const initial = useMemo(() => toFlow(plan.canvasJson), [plan.canvasJson]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ForgeFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState(plan.status);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ tf: Record<string, unknown>; hcl: string } | null>(null);
  const [run, setRun] = useState<{ runId: string; kind: "plan" | "apply" | "destroy" } | null>(null);
  const [confirm, setConfirm] = useState<"apply" | "destroy" | null>(null);
  const dragSnapshot = useRef<ForgeFlowNode[] | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ------------------------- graph mutations ------------------------- */

  const patchForge = useCallback(
    (id: string, patch: Partial<ForgeFlowNode["data"]["forge"]>) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, forge: { ...n.data.forge, ...patch } } } : n,
        ),
      );
    },
    [setNodes],
  );

  const addServiceNode = useCallback(
    (svc: ForgeService, at: { x: number; y: number }, parentId: string | null) => {
      const count = nodes.filter((n) => n.data.forge.serviceId === svc.id).length;
      const id = crypto.randomUUID();
      const node: ForgeFlowNode = {
        id,
        type: svc.isContainer ? "container" : "service",
        position: at,
        ...(parentId ? { parentId, extent: "parent" as const } : {}),
        ...(svc.isContainer ? { style: { ...DEFAULT_CONTAINER } } : {}),
        data: {
          forge: {
            id,
            serviceId: svc.id,
            name: `${svc.label} ${count + 1}`,
            parentId,
            position: at,
            config: { ...svc.defaultConfig },
          },
          serviceLabel: svc.label,
          provider: svc.provider,
          isContainer: svc.isContainer,
          errors: [],
        },
      };
      setNodes((ns) => [...ns, node]);
      setSelectedId(id);
    },
    [nodes, setNodes],
  );

  /** Topmost valid container under an absolute canvas point for a service. */
  const containerAt = useCallback(
    (svc: ForgeService, abs: { x: number; y: number }, excludeId?: string): ForgeFlowNode | null => {
      const candidates = nodes.filter((n) => {
        if (!n.data.isContainer) return false;
        if (!svc.allowedParents.includes(n.data.forge.serviceId)) return false;
        if (excludeId && isAncestorOrSelf(nodes, n.id, excludeId)) return false;
        const pos = absolutePosition(nodes, n.id);
        const w = Number(n.style?.width ?? DEFAULT_CONTAINER.width);
        const h = Number(n.style?.height ?? DEFAULT_CONTAINER.height);
        return abs.x >= pos.x && abs.x <= pos.x + w && abs.y >= pos.y && abs.y <= pos.y + h;
      });
      // Deepest (most nested) wins.
      return (
        candidates.sort((a, b) => {
          const depth = (n: ForgeFlowNode) => {
            let d = 0;
            let cur = n.parentId;
            const byId = new Map(nodes.map((x) => [x.id, x]));
            while (cur) {
              d++;
              cur = byId.get(cur)?.parentId ?? undefined;
            }
            return d;
          };
          return depth(b) - depth(a);
        })[0] ?? null
      );
    },
    [nodes],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!canWrite) return;
      const serviceId = e.dataTransfer.getData(FORGE_DND_MIME);
      const svc = getService(serviceId);
      if (!svc) return;
      const abs = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const container = containerAt(svc, abs);
      if (!container && svc.allowedParents.length > 0 && !["aws.security_group", "aws.rds_instance"].includes(svc.id)) {
        const parents = svc.allowedParents.map((p) => getService(p)?.label ?? p).join(" or ");
        flash(`${svc.label} must be dropped inside: ${parents}`);
        return;
      }
      const position = container
        ? { x: abs.x - absolutePosition(nodes, container.id).x, y: abs.y - absolutePosition(nodes, container.id).y }
        : abs;
      addServiceNode(svc, position, container?.id ?? null);
    },
    [addServiceNode, canWrite, containerAt, flash, nodes, screenToFlowPosition],
  );

  const onNodeDragStart = useCallback(() => {
    dragSnapshot.current = nodes;
  }, [nodes]);

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, dragged: Node) => {
      const node = nodes.find((n) => n.id === dragged.id);
      if (!node) return;
      const svc = getService(node.data.forge.serviceId);
      if (!svc) return;
      const abs = absolutePosition(
        nodes.map((n) => (n.id === dragged.id ? { ...n, position: dragged.position } : n)),
        dragged.id,
      );
      const target = containerAt(svc, abs, dragged.id);
      const currentParent = node.parentId ?? null;
      const nextParent = target?.id ?? null;
      if (nextParent === currentParent) {
        patchForge(dragged.id, { position: dragged.position });
        return;
      }
      if (!nextParent && svc.allowedParents.length > 0 && !["aws.security_group", "aws.rds_instance"].includes(svc.id)) {
        // Dragged out of its required container — snap back.
        if (dragSnapshot.current) setNodes(dragSnapshot.current);
        flash(`${svc.label} must stay inside: ${svc.allowedParents.map((p) => getService(p)?.label ?? p).join(" or ")}`);
        return;
      }
      const rel = nextParent
        ? { x: abs.x - absolutePosition(nodes, nextParent).x, y: abs.y - absolutePosition(nodes, nextParent).y }
        : abs;
      setNodes((ns) => {
        const moved = ns.map((n) =>
          n.id === dragged.id
            ? {
                ...n,
                parentId: nextParent ?? undefined,
                extent: nextParent ? ("parent" as const) : undefined,
                position: rel,
                data: { ...n.data, forge: { ...n.data.forge, parentId: nextParent, position: rel } },
              }
            : n,
        );
        // Parents must precede children in the array for React Flow.
        return toFlow(fromFlow(moved, edges)).nodes.map((fresh) => ({
          ...fresh,
          selected: fresh.id === dragged.id,
        }));
      });
    },
    [containerAt, edges, flash, nodes, patchForge, setNodes],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!canWrite) return;
      setEdges((es) => addEdge({ ...conn, id: crypto.randomUUID() }, es));
    },
    [canWrite, setEdges],
  );

  const deleteNode = useCallback(
    (id: string) => {
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of nodes) {
          if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
            doomed.add(n.id);
            grew = true;
          }
        }
      }
      setNodes((ns) => ns.filter((n) => !doomed.has(n.id)));
      setEdges((es) => es.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)));
      setSelectedId(null);
    },
    [nodes, setEdges, setNodes],
  );

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedId(sel[0]?.id ?? null);
  }, []);

  /* --------------------------- api actions --------------------------- */

  const applyIssues = useCallback(
    (issues: ForgeValidationIssue[]) => {
      const map = new Map<string, string[]>();
      for (const i of issues) {
        if (!i.nodeId) continue;
        map.set(i.nodeId, [...(map.get(i.nodeId) ?? []), i.message]);
      }
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, errors: map.get(n.id) ?? [] } })));
      const general = issues.filter((i) => !i.nodeId);
      if (general.length) flash(general[0]!.message);
      else if (issues.length) flash(`${issues.length} validation issue${issues.length > 1 ? "s" : ""} — see marked nodes`);
    },
    [flash, setNodes],
  );

  const save = useCallback(async (): Promise<boolean> => {
    setBusy("save");
    try {
      const res = await fetch(`/api/forge/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromFlow(nodes, edges)),
      });
      const body = (await res.json()) as ApiEnvelope<{ status: string }>;
      if (!body.success) {
        flash(body.error ?? "Save failed");
        return false;
      }
      setStatus("draft");
      return true;
    } catch {
      flash("Network error while saving");
      return false;
    } finally {
      setBusy(null);
    }
  }, [edges, flash, nodes, plan.id]);

  const generate = useCallback(async () => {
    if (!(await save())) return;
    setBusy("generate");
    try {
      const res = await fetch(`/api/forge/plans/${plan.id}/generate`, { method: "POST" });
      const body = (await res.json()) as ApiEnvelope<{
        tf?: Record<string, unknown>;
        hcl?: string;
        issues?: ForgeValidationIssue[];
      }>;
      if (!body.success) {
        applyIssues(body.data?.issues ?? []);
        if (!body.data?.issues?.length) flash(body.error ?? "Generation failed");
        return;
      }
      applyIssues([]);
      setStatus("generated");
      setPreview({ tf: body.data!.tf!, hcl: body.data!.hcl! });
    } catch {
      flash("Network error while generating");
    } finally {
      setBusy(null);
    }
  }, [applyIssues, flash, plan.id, save]);

  const startRun = useCallback(
    async (kind: "plan" | "apply" | "destroy") => {
      setBusy(kind);
      try {
        const res = await fetch(`/api/forge/plans/${plan.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        const body = (await res.json()) as ApiEnvelope<{ runId: string }>;
        if (!body.success || !body.data) {
          flash(body.error ?? "Run failed to start");
          return;
        }
        setRun({ runId: body.data.runId, kind });
      } catch {
        flash("Network error while starting the run");
      } finally {
        setBusy(null);
      }
    },
    [flash, plan.id],
  );

  const onRunFinished = useCallback(
    (result: string) => {
      if (!run) return;
      if (result === "succeeded") {
        setStatus(run.kind === "plan" ? "planned" : run.kind === "apply" ? "deployed" : "destroyed");
      } else {
        setStatus("failed");
      }
    },
    [run],
  );

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0">
      <Palette
        disabled={!canWrite}
        onAdd={(svc) => {
          const abs = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          const container = containerAt(svc, abs);
          if (!container && svc.allowedParents.length > 0 && !["aws.security_group", "aws.rds_instance"].includes(svc.id)) {
            flash(`${svc.label} needs a container — drag it into one`);
            return;
          }
          const position = container
            ? { x: abs.x - absolutePosition(nodes, container.id).x, y: abs.y - absolutePosition(nodes, container.id).y }
            : abs;
          addServiceNode(svc, position, container?.id ?? null);
        }}
      />

      <div className="relative min-w-0 flex-1">
        {/* Toolbar */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-surface-base/90 px-4 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/forge" className="text-mute transition-colors hover:text-ink" aria-label="Back to plans">
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <Hammer size={14} strokeWidth={1.5} className="shrink-0 text-mute" />
            <span className="truncate text-[13px] font-medium text-ink">{plan.name}</span>
            <Badge>{status}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!canWrite || busy !== null} onClick={() => void save()}>
              <Save size={13} strokeWidth={1.5} />
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" size="sm" disabled={!canWrite || busy !== null} onClick={() => void generate()}>
              {busy === "generate" ? "Generating…" : "Generate"}
            </Button>
            <Button variant="secondary" size="sm" disabled={!canWrite || busy !== null} onClick={() => void startRun("plan")}>
              <Play size={13} strokeWidth={1.5} />
              Plan
            </Button>
            {canDeploy ? (
              <>
                <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => setConfirm("apply")}>
                  <Rocket size={13} strokeWidth={1.5} />
                  Deploy
                </Button>
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setConfirm("destroy")}>
                  <Trash2 size={13} strokeWidth={1.5} />
                  Destroy
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {toast ? (
          <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-md border border-negative/40 bg-surface-card px-4 py-2 text-[12px] text-negative shadow-lg">
            {toast}
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodesDraggable={canWrite}
          nodesConnectable={canWrite}
          elementsSelectable
          deleteKeyCode={canWrite ? ["Backspace", "Delete"] : []}
          onNodesDelete={(deleted) => deleted.forEach((n) => deleteNode(n.id))}
          proOptions={{ hideAttribution: true }}
          fitView
          className="!bg-transparent pt-11"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} className="opacity-40" />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>

      <Inspector
        node={selected}
        disabled={!canWrite}
        onRename={(id, name) => patchForge(id, { name })}
        onConfigChange={(id, key, value) => {
          const node = nodes.find((n) => n.id === id);
          if (!node) return;
          patchForge(id, { config: { ...node.data.forge.config, [key]: value } });
        }}
        onDelete={deleteNode}
      />

      <TfPreview
        open={preview !== null}
        planName={plan.name}
        tf={preview?.tf ?? null}
        hcl={preview?.hcl ?? ""}
        onClose={() => setPreview(null)}
      />
      <RunDrawer
        open={run !== null}
        planId={plan.id}
        runId={run?.runId ?? null}
        kind={run?.kind ?? "plan"}
        onClose={() => setRun(null)}
        onFinished={onRunFinished}
      />
      <ConfirmDialog
        open={confirm !== null}
        planName={plan.name}
        kind={confirm ?? "apply"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const kind = confirm!;
          setConfirm(null);
          void startRun(kind);
        }}
      />
    </div>
  );
}
