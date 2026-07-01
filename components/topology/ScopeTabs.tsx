"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TOPO_ENV_SCOPES, TOPO_SCOPE_LABEL, type TopoEnvScope } from "@/lib/topology/types";
import { cn } from "@/lib/utils/cn";

/** Environment scope switcher. Navigation drives the graph: switching pushes the
 *  scope into the URL so the server re-queries + re-lays-out the real weave. */
export function ScopeTabs({ active }: { active: TopoEnvScope }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
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
          onClick={() => startTransition(() => router.replace(`/topology?env=${s}`, { scroll: false }))}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] transition-colors",
            active === s ? "bg-surface-card text-on-dark" : "text-mute hover:text-body",
          )}
        >
          {TOPO_SCOPE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
