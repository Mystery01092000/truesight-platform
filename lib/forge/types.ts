/** Canvas graph — the persisted source of truth for a Forge plan. */
export interface ForgeNode {
  id: string;
  serviceId: string;
  name: string;
  parentId: string | null;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  config: Record<string, unknown>;
}

export interface ForgeEdge {
  id: string;
  source: string;
  target: string;
}

export interface ForgeCanvas {
  nodes: ForgeNode[];
  edges: ForgeEdge[];
}

export type ForgePlanStatus =
  | "draft"
  | "generated"
  | "planned"
  | "deploying"
  | "deployed"
  | "failed"
  | "destroyed";

export type ForgeRunKind = "plan" | "apply" | "destroy";
export type ForgeRunStatus = "running" | "succeeded" | "failed";

export interface ForgeValidationIssue {
  nodeId: string | null;
  message: string;
}
