"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TOOLS, TOOL_LABELS, type Tool } from "@/lib/ticketing/types";

/**
 * ToolMultiSelect — a dropdown panel of checkboxes for selecting the developer
 * tools to request access to. Monochrome, surface-ladder styling. Shows the
 * selected count (or a placeholder) when collapsed.
 */
export function ToolMultiSelect({
  value,
  onChange,
  className,
}: {
  value: Tool[];
  onChange: (next: Tool[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = new Set(value);

  function toggle(tool: Tool) {
    const next = new Set(selected);
    if (next.has(tool)) next.delete(tool);
    else next.add(tool);
    onChange(Array.from(next));
  }

  const label =
    selected.size === 0
      ? "Select tools"
      : selected.size === 1
        ? TOOL_LABELS[Array.from(selected)[0]]
        : `${selected.size} tools selected`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-hairline bg-surface-elevated px-3 text-[16px] leading-[1.6] transition-colors",
          "hover:border-hairline-strong focus:border-hairline-strong focus:outline-none",
          selected.size > 0 ? "text-on-dark" : "text-ash",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className={cn("text-mute transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-hairline bg-surface-card py-1"
        >
          {TOOLS.map((tool) => {
            const active = selected.has(tool);
            return (
              <button
                key={tool}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(tool)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] leading-[1.5] transition-colors hover:bg-surface-elevated",
                  active ? "text-on-dark" : "text-body",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-[3px] border transition-colors",
                    active ? "border-on-dark bg-on-dark" : "border-hairline-strong",
                  )}
                >
                  {active && <Check size={11} strokeWidth={2.5} className="text-on-primary" />}
                </span>
                {TOOL_LABELS[tool]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
