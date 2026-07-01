import type {
  CloudProvider,
  ResourceKind,
  ResourceStatus,
  EdgeKind,
} from "@/lib/taxonomy";

/**
 * The provider-agnostic backbone. AWS, Azure, GitHub and Terraform all normalize into
 * `CloudResource` keyed by `urn` — the single join key across live discovery, Terraform
 * state, and the Postgres KB, so the topology + explorers never care which cloud a node
 * came from.
 */
export interface CloudResource {
  /** `${provider}:${account}:${region ?? 'global'}:${service}:${nativeId}` */
  urn: string;
  provider: CloudProvider;
  account: string;
  region: string | null;
  service: string;
  /** canonical taxonomy kind (e.g. 'container', 'database') */
  kind: ResourceKind;
  /** provider-native type, e.g. 'aws_ecs_service' | 'Microsoft.Network/virtualNetworks' */
  nativeType: string;
  name: string;
  nativeId: string;
  arn?: string;
  environment?: string;
  status: ResourceStatus;
  tags: Record<string, string>;
  attributes: Record<string, unknown>;
  relationships: ResourceRef[];
  source: "live" | "terraform-state";
  discoveredAt: string;
}

export interface ResourceRef {
  targetUrn: string;
  kind: EdgeKind;
}

export interface GraphNode {
  id: string;
  type: "resource" | "module" | "account" | "env" | "docker-stage" | "tf-module" | "jenkins-stage";
  data: Record<string, unknown>;
  position?: { x: number; y: number };
  parentId?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  animated?: boolean;
}

export interface AdapterError {
  provider: CloudProvider;
  scope: string;
  code: string;
  message: string;
  retryable: boolean;
}

export interface DiscoveryResult {
  resources: CloudResource[];
  edges: GraphEdge[];
  /** true when some scope failed but we still returned what succeeded */
  partial: boolean;
  errors: AdapterError[];
}

export interface AdapterHealth {
  provider: CloudProvider;
  instanceId: string;
  ok: boolean;
  detail?: string;
}

export interface DiscoverOptions {
  regions?: string[];
  services?: string[];
  signal?: AbortSignal;
}

/**
 * Every integration is a pure factory `create*Adapter(cfg)` returning this — no
 * module-level mutable state, so it's safe to run concurrently across Fargate tasks.
 */
export interface IntegrationAdapter {
  readonly provider: CloudProvider;
  readonly instanceId: string;
  healthCheck(): Promise<AdapterHealth>;
  discover(opts?: DiscoverOptions): Promise<DiscoveryResult>;
}

/** Compose a canonical URN. */
export function makeUrn(parts: {
  provider: CloudProvider;
  account: string;
  region?: string | null;
  service: string;
  nativeId: string;
}): string {
  return `${parts.provider}:${parts.account}:${parts.region ?? "global"}:${parts.service}:${parts.nativeId}`;
}
