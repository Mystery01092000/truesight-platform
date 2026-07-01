import type {
  ResourceKind,
  ResourceStatus,
  EdgeKind,
  DriftStatus,
} from "@/lib/taxonomy";

/**
 * Topology graph contract — the single shape shared by the server graph builder
 * (`graph.ts`), the server layout engine (`layout.ts`), the RSC page, and the
 * client `TopologyCanvas`. Positions are always present (filled by the layout
 * pass) so the canvas paints deterministically on first render with no client
 * layout jump. Keep this free of React and DB imports — it is a pure contract.
 */

/** Environment scopes the canvas can be filtered to. `all` = the whole weave. */
export const TOPO_ENV_SCOPES = ["prod", "dev", "uat", "all"] as const;
export type TopoEnvScope = (typeof TOPO_ENV_SCOPES)[number];

export const TOPO_SCOPE_LABEL: Record<TopoEnvScope, string> = {
  prod: "Production",
  dev: "Development",
  uat: "UAT",
  all: "All environments",
};

/** Per-node payload rendered by `ResourceNode`. */
export type TopoNodeData = {
  urn: string;
  name: string;
  kind: ResourceKind;
  service: string;
  provider: string;
  account: string;
  accountLabel: string;
  region: string | null;
  environment: string | null;
  status: ResourceStatus;
  /** Terraform drift classification; `unknown` until the drift engine populates it. */
  drift: DriftStatus;
  nativeType: string | null;
  /** Seconds of entrance delay, derived from layout layer (cascade left → right). */
  appearDelay: number;
  /** True when this node summarizes many collapsed structural leaves (mind-map
   *  curation) — e.g. "24 network resources" standing in for a VPC's subnets/SGs. */
  isCluster?: boolean;
  clusterCount?: number;
  /** Names of the collapsed members, surfaced in the detail panel. */
  clusterMembers?: string[];
};

export type TopoNode = {
  id: string;
  data: TopoNodeData;
  position: { x: number; y: number };
  width: number;
  height: number;
  /** Group key this node belongs to (an account). */
  group: string;
};

/** A visual container drawn behind its member nodes (one per account). */
export type TopoGroup = {
  id: string;
  label: string;
  account: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

export type TopoEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
};

export type TopoStats = {
  scope: TopoEnvScope;
  nodes: number;
  edges: number;
  accounts: { account: string; label: string; n: number }[];
  byKind: { kind: ResourceKind; n: number }[];
  /** Count of resources in this scope that carry drift classification != in_sync. */
  drifted: number;
};

export type TopoGraph = {
  nodes: TopoNode[];
  groups: TopoGroup[];
  edges: TopoEdge[];
  stats: TopoStats;
};

/** Fixed node box used by both the layout engine and the rendered card. */
export const NODE_W = 216;
export const NODE_H = 66;
