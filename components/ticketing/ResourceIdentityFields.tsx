"use client";

import { TextInput } from "@/components/ui/TextInput";
import { TOOL_LABELS, type Tool } from "@/lib/ticketing/types";
import { TOOL_RESOURCES, toolsNeedingResources } from "@/lib/ticketing/tools";

export type ResourceIdentityMap = Partial<Record<Tool, string>>;

/**
 * ResourceIdentityFields — renders a resource-identity input per selected tool
 * that requires one. AWS shows an ARN field; Jenkins/Grafana/Superset show a
 * Team-name field that is auto-filled from the requester's team (editable).
 */
export function ResourceIdentityFields({
  tools,
  team,
  value,
  onChange,
}: {
  tools: Tool[];
  team: string;
  value: ResourceIdentityMap;
  onChange: (next: ResourceIdentityMap) => void;
}) {
  const scoped = toolsNeedingResources(tools);
  if (scoped.length === 0) return null;

  return (
    <div className="space-y-3">
      {scoped.map((tool) => {
        const cfg = TOOL_RESOURCES[tool];
        const current = value[tool] ?? (cfg.autoFillFromTeam ? team : "");
        return (
          <div key={tool}>
            <label className="mb-1.5 block text-label leading-[1.5] text-body">
              {TOOL_LABELS[tool]} — {cfg.resourceLabel}
            </label>
            <TextInput
              value={current}
              onChange={(e) => onChange({ ...value, [tool]: e.target.value })}
              placeholder={cfg.resourcePlaceholder}
            />
          </div>
        );
      })}
    </div>
  );
}
