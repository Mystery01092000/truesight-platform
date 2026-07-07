import type { z } from "zod";
import type { ForgeNode } from "@/lib/forge/types";

export type ForgeProvider = "aws" | "azure";
export type ForgeCategory =
  | "network"
  | "compute"
  | "storage"
  | "database"
  | "serverless"
  | "containers"
  | "identity"
  | "observability";

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  required?: boolean;
}
export type ForgeField =
  | (FieldBase & { type: "text"; placeholder?: string })
  | (FieldBase & { type: "number"; min?: number; max?: number })
  | (FieldBase & { type: "select"; options: { value: string; label: string }[] })
  | (FieldBase & { type: "toggle" });

/** Everything toTf() may need about the surrounding graph. */
export interface TfContext {
  /** Unique terraform name for a node (slug + collision suffix). */
  tfName(nodeId: string): string;
  /** Nearest ancestor with the given serviceId, if any. */
  ancestorOfService(nodeId: string, serviceId: string): ForgeNode | undefined;
  /** Target nodes of outgoing dependency edges from this node. */
  edgesFrom(nodeId: string): ForgeNode[];
  awsRegion: string;
  azureLocation: string;
}

/** tf.json fragment — merged into the final document. */
export interface TfFragment {
  resource?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface ForgeService {
  id: string;
  provider: ForgeProvider;
  label: string;
  category: ForgeCategory;
  isContainer: boolean;
  /** serviceIds this node may be dropped into; [] = top level only. */
  allowedParents: readonly string[];
  defaultConfig: Record<string, unknown>;
  schema: z.ZodType;
  fields: ForgeField[];
  toTf(node: ForgeNode, ctx: TfContext): TfFragment;
}
