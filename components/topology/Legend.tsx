"use client";

import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { RESOURCE_KIND_ACCENT, type AccentToken, type ResourceStatus, type DriftStatus } from "@/lib/taxonomy";

/** Reads the weave: three colour domains (kind, health, drift) plus the edge
 *  key and cluster count — the complete visual vocabulary documented in one
 *  quiet panel so the canvas explains itself without competing. */

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
  { color: "var(--color-accent-green)", label: "Healthy" },
  { color: "var(--color-accent-yellow)", label: "Degraded" },
  { color: "var(--color-accent-red)", label: "Stopped" },
  { color: "var(--color-stone)", label: "Unknown" },
];

const DRIFT: { ring: string; label: string }[] = [
  { ring: "", label: "In sync" },
  { ring: "ring-2 ring-accent-yellow/60", label: "Drifted" },
  { ring: "ring-2 ring-accent-red/70", label: "Missing" },
  { ring: "ring-1 ring-accent-blue/50", label: "Unmanaged" },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] uppercase tracking-[0.06em] text-ash">{children}</div>
  );
}

function KindRow({ accent }: { accent: AccentToken }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ background: ACCENT_COLOR[accent] }}
        aria-hidden
      />
      <span className="text-[11px] text-mute">{ACCENT_LABEL[accent]}</span>
    </div>
  );
}

function HealthRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span className="text-[11px] text-mute">{label}</span>
    </div>
  );
}

function DriftRow({ ring, label }: { ring: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`size-3 shrink-0 rounded-[3px] border border-hairline bg-surface-card ${ring}`}
        aria-hidden
      />
      <span className="text-[11px] text-mute">{label}</span>
    </div>
  );
}

function EdgeKey({ stroke, dash, flow, label }: { stroke: string; dash?: string; flow?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="8" viewBox="0 0 26 8" className="shrink-0">
        <line
          x1="1"
          y1="4"
          x2="25"
          y2="4"
          stroke={stroke}
          strokeWidth={flow ? 1.6 : 1.2}
          strokeDasharray={flow ? "5 6" : dash}
          className={flow ? "topo-edge-flow" : undefined}
        />
      </svg>
      <span className="text-[11px] text-mute">{label}</span>
    </div>
  );
}

export function Legend() {
  const kindAccents = [...new Set(Object.values(RESOURCE_KIND_ACCENT))] as AccentToken[];
  return (
    <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-lg border border-hairline bg-surface/85 px-3 py-2.5 backdrop-blur-md">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.06em] text-ash">The weave</div>

      {/* ── Kind (glyph tile colour) ── */}
      <SectionLabel>Kind</SectionLabel>
      <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {kindAccents.map((a) => (
          <KindRow key={a} accent={a} />
        ))}
      </div>

      {/* ── Health (left rail) ── */}
      <div className="border-t border-hairline pt-2">
        <SectionLabel>Health</SectionLabel>
        <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {HEALTH.map((h) => (
            <HealthRow key={h.label} color={h.color} label={h.label} />
          ))}
        </div>
      </div>

      {/* ── Drift (ring) ── */}
      <div className="border-t border-hairline pt-2">
        <SectionLabel>Drift</SectionLabel>
        <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {DRIFT.map((d) => (
            <DriftRow key={d.label} ring={d.ring} label={d.label} />
          ))}
        </div>
      </div>

      {/* ── Edges ── */}
      <div className="border-t border-hairline pt-2">
        <SectionLabel>Edges</SectionLabel>
        <div className="mb-1 flex flex-col gap-1.5">
          <EdgeKey stroke="var(--color-iris)" flow label="uses / routes" />
          <EdgeKey stroke="#6fe5b0" flow label="deployed from" />
          <EdgeKey stroke="var(--color-mute)" dash="2 4" label="depends on" />
          <EdgeKey stroke="var(--color-stone)" label="contains" />
        </div>
      </div>

      {/* ── Cluster ── */}
      <div className="mt-1.5 flex items-center gap-1.5 border-t border-hairline pt-2">
        <span className="grid size-3.5 shrink-0 place-items-center rounded-[3px] border border-dashed border-hairline bg-surface-card">
          <Layers size={8} className="text-mute" />
        </span>
        <span className="text-[11px] text-mute">Grouped resources</span>
      </div>
    </div>
  );
}
