import type { Tool } from "@/lib/ticketing/types";

/**
 * Tool definitions for access tickets. Some tools need a scoped resource
 * identity field (an ARN for AWS, a Team name for Jenkins/Grafana/Superset);
 * the rest (Azure) are broad console-style access with no per-resource scope.
 */

export type ToolResourceConfig = {
  /** Whether this tool shows a resource-identity input on the request form. */
  needsResourceIdentity: boolean;
  /** Label shown above the resource-identity field. */
  resourceLabel: string;
  /** Placeholder for the resource-identity field. */
  resourcePlaceholder: string;
  /** Whether the resource field should be auto-filled from the requester's Team. */
  autoFillFromTeam: boolean;
};

export const TOOL_RESOURCES: Record<Tool, ToolResourceConfig> = {
  aws: {
    needsResourceIdentity: true,
    resourceLabel: "Resource Identity (ARN)",
    resourcePlaceholder: "arn:aws:s3:::my-bucket",
    autoFillFromTeam: false,
  },
  azure: {
    needsResourceIdentity: false,
    resourceLabel: "",
    resourcePlaceholder: "",
    autoFillFromTeam: false,
  },
  jenkins: {
    needsResourceIdentity: true,
    resourceLabel: "Team Name",
    resourcePlaceholder: "team name",
    autoFillFromTeam: true,
  },
  grafana: {
    needsResourceIdentity: true,
    resourceLabel: "Team Name",
    resourcePlaceholder: "team name",
    autoFillFromTeam: true,
  },
  superset: {
    needsResourceIdentity: true,
    resourceLabel: "Team Name",
    resourcePlaceholder: "team name",
    autoFillFromTeam: true,
  },
};

/** Returns the resource-identity field label for a tool (empty when none is needed). */
export function getToolResourceLabel(tool: Tool): string {
  return TOOL_RESOURCES[tool].resourceLabel;
}

/** The subset of tools that require a resource-identity field on the form. */
export function toolsNeedingResources(tools: Tool[]): Tool[] {
  return tools.filter((t) => TOOL_RESOURCES[t].needsResourceIdentity);
}
