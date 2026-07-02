"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  TOPO_ENV_SCOPES,
  TOPO_SCOPE_LABEL,
  TOPO_LAYOUT_MODES,
  TOPO_LAYOUT_LABEL,
  type TopoEnvScope,
  type TopoLayoutMode,
} from "@/lib/topology/types";
import { cn } from "@/lib/utils/cn";

/** Environment scope switcher + layout mode toggle. Navigation drives the graph:
 *  switching pushes scope/layout into the URL so the server re-queries +
 *  re-lays-out the real weave. */
export function ScopeTabs({
  active,
  layout = "layered",
}: {
  active: TopoEnvScope;
  layout?: TopoLayoutMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (env: TopoEnvScope, mode: TopoLayoutMode) =>
    startTransition(() =>
      router.replace(`/topology?env=${env}&layout=${mode}`, { scroll: false }),
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-surface p-0.5 transition-opacity",
          pending && "opacity-60",
        )}
      >
        {TOPO_ENV_SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={active === s}
            onClick={() => go(s, layout)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12.5px] transition-colors",
              active === s ? "bg-surface-card text-on-dark" : "text-mute hover:text-body",
            )}
          >
            {TOPO_SCOPE_LABEL[s]}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-surface p-0.5 transition-opacity",
          pending && "opacity-60",
        )}
      >
        {TOPO_LAYOUT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={layout === m}
            onClick={() => go(active, m)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12.5px] transition-colors",
              layout === m ? "bg-surface-card text-on-dark" : "text-mute hover:text-body",
            )}
          >
            {TOPO_LAYOUT_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
