"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Layers, SwatchBook } from "lucide-react";
import { PillTabs } from "@/components/ui/PillTabs";
import {
  TOPO_ENV_SCOPES,
  TOPO_SCOPE_LABEL,
  TOPO_LAYOUT_MODES,
  TOPO_LAYOUT_LABEL,
  TOPO_PROVIDERS,
  TOPO_PROVIDER_LABEL,
  type TopoEnvScope,
  type TopoLayoutMode,
  type TopoProvider,
} from "@/lib/topology/types";
import { RESOURCE_KIND_ACCENT, type AccentToken } from "@/lib/taxonomy";
import { cn } from "@/lib/utils/cn";

/**
 * Topology chrome — one toolbar row owning every canvas control. Left: provider
 * switcher (All | AWS | Azure) and environment scope, both as PillTabs driving
 * the URL (the server re-queries + re-lays-out). Right: layout mode select, the
 * legend folded into a popover, and live node/edge counts in micro mono.
 */
export function TopoToolbar({
  scope,
  layout,
  provider,
  nodes,
  edges,
}: {
  scope: TopoEnvScope;
  layout: TopoLayoutMode;
  provider: TopoProvider;
  nodes: number;
  edges: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (env: TopoEnvScope, mode: TopoLayoutMode, prov: TopoProvider) =>
    startTransition(() =>
      router.replace(`/topology?env=${env}&layout=${mode}&provider=${prov}`, { scroll: false }),
    );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity duration-150 ease-smooth",
        pending && "opacity-60",
      )}
    >
      <div className="rounded-full border border-hairline bg-surface p-0.5">
        <PillTabs
          aria-label="Cloud provider"
          value={provider}
          onChange={(v) => go(scope, layout, v as TopoProvider)}
          items={TOPO_PROVIDERS.map((p) => ({ value: p, label: TOPO_PROVIDER_LABEL[p] }))}
        />
      </div>

      <div className="rounded-full border border-hairline bg-surface p-0.5">
        <PillTabs
          aria-label="Environment scope"
          value={scope}
          onChange={(v) => go(v as TopoEnvScope, layout, provider)}
          items={TOPO_ENV_SCOPES.map((s) => ({ value: s, label: TOPO_SCOPE_LABEL[s] }))}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="sr-only" htmlFor="topo-layout-mode">
          Layout mode
        </label>
        <select
          id="topo-layout-mode"
          value={layout}
          onChange={(e) => go(scope, e.target.value as TopoLayoutMode, provider)}
          className="h-8 rounded-md border border-hairline bg-surface px-2 text-[12.5px] text-body transition-colors duration-150 ease-smooth hover:border-hairline-strong focus:outline-none focus-visible:border-hairline-strong"
        >
          {TOPO_LAYOUT_MODES.map((m) => (
            <option key={m} value={m}>
              {TOPO_LAYOUT_LABEL[m]}
            </option>
          ))}
        </select>

        <LegendPopover />

        <span className="font-mono text-micro tabular-nums text-ash">
          {nodes} nodes · {edges} edges
        </span>
      </div>
    </div>
  );
}

/* ── Legend (folded from the former Legend.tsx panel) ─────────────────── */

const ACCENT_COLOR: Record<AccentToken, string> = {
  "accent-blue": "var(--color-accent-blue)",
  "accent-green": "var(--color-accent-green)",
  "accent-red": "var(--color-accent-red)",
  "accent-yellow": "var(--color-accent-yellow)",
  mute: "var(--color-mute)",
};

const ACCENT_LABEL: Record<AccentToken, string> = {
  "accent-blue": "Infra / compute",
  "accent-green": "Data / storage",
  "accent-red": "Identity / secrets",
  "accent-yellow": "AI / monitoring",
  mute: "Source control",
};

const HEALTH: { color: string; label: string }[] = [
  { color: "var(--color-positive)", label: "Healthy" },
  { color: "var(--color-warning)", label: "Degraded" },
  { color: "var(--color-critical)", label: "Stopped" },
  { color: "var(--color-stone)", label: "Unknown" },
];

const DRIFT: { ring: string; label: string }[] = [
  { ring: "", label: "In sync" },
  { ring: "ring-2 ring-accent-yellow/60", label: "Drifted" },
  { ring: "ring-2 ring-accent-red/70", label: "Missing" },
  { ring: "ring-1 ring-accent-blue/50", label: "Unmanaged" },
];

/** Edge key — mirrors FlowEdge's KIND_STYLE token strokes. */
const EDGE_KEYS: { stroke: string; dash?: string; label: string }[] = [
  { stroke: "var(--color-iris)", label: "uses" },
  { stroke: "var(--color-info)", label: "routes to" },
  { stroke: "var(--color-positive)", dash: "3 5", label: "deployed from" },
  { stroke: "var(--color-mute)", dash: "3 5", label: "depends on" },
  { stroke: "var(--color-stone)", label: "contains" },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[10px] uppercase tracking-[0.06em] text-ash">{children}</div>;
}

function LegendPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const kindAccents = [...new Set(Object.values(RESOURCE_KIND_ACCENT))] as AccentToken[];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12.5px] transition-colors duration-150 ease-smooth",
          open ? "border-hairline-strong text-on-dark" : "text-mute hover:border-hairline-strong hover:text-body",
        )}
      >
        <SwatchBook size={13} aria-hidden />
        Legend
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Topology legend"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-hairline bg-surface-elevated px-3 py-2.5 shadow-overlay"
        >
          <SectionLabel>Kind</SectionLabel>
          <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
            {kindAccents.map((a) => (
              <div key={a} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: ACCENT_COLOR[a] }}
                  aria-hidden
                />
                <span className="text-[11px] text-mute">{ACCENT_LABEL[a]}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-hairline pt-2">
            <SectionLabel>Health</SectionLabel>
            <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {HEALTH.map((h) => (
                <div key={h.label} className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: h.color }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-mute">{h.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-hairline pt-2">
            <SectionLabel>Drift</SectionLabel>
            <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {DRIFT.map((d) => (
                <div key={d.label} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-[3px] border border-hairline bg-surface-card",
                      d.ring,
                    )}
                    aria-hidden
                  />
                  <span className="text-[11px] text-mute">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-hairline pt-2">
            <SectionLabel>Edges</SectionLabel>
            <div className="mb-1 flex flex-col gap-1.5">
              {EDGE_KEYS.map((e) => (
                <div key={e.label} className="flex items-center gap-2">
                  <svg width="26" height="8" viewBox="0 0 26 8" className="shrink-0" aria-hidden>
                    <line
                      x1="1"
                      y1="4"
                      x2="25"
                      y2="4"
                      stroke={e.stroke}
                      strokeWidth={1.4}
                      strokeDasharray={e.dash}
                    />
                  </svg>
                  <span className="text-[11px] text-mute">{e.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 border-t border-hairline pt-2">
            <span className="grid size-3.5 shrink-0 place-items-center rounded-[3px] border border-dashed border-hairline bg-surface-card">
              <Layers size={8} className="text-mute" aria-hidden />
            </span>
            <span className="text-[11px] text-mute">Grouped resources — click to expand</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
