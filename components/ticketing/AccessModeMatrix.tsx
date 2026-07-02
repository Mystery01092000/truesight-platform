"use client";

import { cn } from "@/lib/utils/cn";
import { Check } from "lucide-react";
import { TOOL_LABELS, type AccessMode, type Tool } from "@/lib/ticketing/types";

const MODES: AccessMode[] = ["read", "write", "full"];

export type AccessModeMap = Partial<Record<Tool, AccessMode>>;

/**
 * AccessModeMatrix — for each selected tool, a row of three mode pills
 * (read / write / full). Exactly one mode is active per tool (radio-like).
 */
export function AccessModeMatrix({
  tools,
  value,
  onChange,
}: {
  tools: Tool[];
  value: AccessModeMap;
  onChange: (next: AccessModeMap) => void;
}) {
  if (tools.length === 0) return null;

  function pick(tool: Tool, mode: AccessMode) {
    onChange({ ...value, [tool]: mode });
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      {/* header */}
      <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] border-b border-hairline bg-surface-elevated">
        <div className="px-3.5 py-2 text-[12px] font-medium uppercase tracking-[0.4px] text-mute">
          Tool
        </div>
        {MODES.map((m) => (
          <div
            key={m}
            className="px-3.5 py-2 text-center text-[12px] font-medium uppercase tracking-[0.4px] text-mute"
          >
            {m}
          </div>
        ))}
      </div>
      {/* rows */}
      {tools.map((tool) => (
        <div
          key={tool}
          className="grid grid-cols-[1.2fr_repeat(3,1fr)] border-b border-hairline last:border-0"
        >
          <div className="px-3.5 py-2.5 text-[14px] font-medium leading-[1.6] text-on-dark">
            {TOOL_LABELS[tool]}
          </div>
          {MODES.map((m) => {
            const active = value[tool] === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(tool, m)}
                className="grid place-items-center px-3.5 py-2.5 transition-colors hover:bg-surface-elevated"
                aria-pressed={active}
                aria-label={`${TOOL_LABELS[tool]} ${m}`}
              >
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border transition-colors",
                    active ? "border-on-dark bg-on-dark" : "border-hairline-strong",
                  )}
                >
                  {active && <Check size={11} strokeWidth={2.5} className="text-on-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
