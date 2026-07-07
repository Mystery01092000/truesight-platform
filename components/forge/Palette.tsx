"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FORGE_SERVICES, type ForgeCategory, type ForgeProvider, type ForgeService } from "@/lib/forge/catalog";
import { CATEGORY_ICON, PROVIDER_HEX } from "@/components/forge/service-icons";
import { cn } from "@/lib/utils/cn";

export const FORGE_DND_MIME = "application/x-forge-service";

const CATEGORY_ORDER: ForgeCategory[] = [
  "network", "compute", "storage", "database", "serverless", "containers", "identity", "observability",
];

interface PaletteProps {
  disabled: boolean;
  onAdd: (service: ForgeService) => void;
}

/** Left rail: provider tabs → category groups → draggable service tiles. */
export function Palette({ disabled, onAdd }: PaletteProps) {
  const [provider, setProvider] = useState<ForgeProvider>("aws");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const services = FORGE_SERVICES.filter(
      (s) => s.provider === provider && (!q || s.label.toLowerCase().includes(q) || s.id.includes(q)),
    );
    return CATEGORY_ORDER.map((cat) => ({ cat, services: services.filter((s) => s.category === cat) })).filter(
      (g) => g.services.length > 0,
    );
  }, [provider, query]);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-surface-base">
      <div className="flex gap-1 p-3 pb-2">
        {(["aws", "azure"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProvider(p)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.5px] transition-colors",
              provider === p ? "bg-surface-card text-ink" : "text-mute hover:text-body",
            )}
          >
            <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: PROVIDER_HEX[p] }} aria-hidden />
            {p}
          </button>
        ))}
      </div>
      <div className="relative mx-3 mb-2">
        <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-2.5 top-2 text-ash" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services…"
          className="h-8 w-full rounded-md border border-hairline bg-surface-card pl-8 pr-2 text-[12px] text-ink outline-none placeholder:text-ash focus:border-iris"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map(({ cat, services }) => {
          const Icon = CATEGORY_ICON[cat];
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-micro uppercase tracking-[0.6px] text-ash">
                <Icon size={11} strokeWidth={1.5} />
                {cat}
              </div>
              <div className="flex flex-col gap-1">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    draggable={!disabled}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(FORGE_DND_MIME, svc.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDoubleClick={() => !disabled && onAdd(svc)}
                    title={disabled ? "Read-only" : "Drag onto the canvas (or double-click to add)"}
                    className={cn(
                      "flex items-center justify-between rounded-md border border-hairline bg-surface-card px-2.5 py-1.5 text-[12px] text-body",
                      disabled ? "opacity-50" : "cursor-grab hover:border-iris hover:text-ink active:cursor-grabbing",
                    )}
                  >
                    <span className="truncate">{svc.label}</span>
                    {svc.isContainer ? <span className="font-mono text-[9px] uppercase text-ash">group</span> : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {groups.length === 0 ? <p className="mt-6 text-center text-[12px] text-ash">No services match.</p> : null}
      </div>
    </aside>
  );
}
