import { z } from 'zod';

/**
 * Truesight canonical taxonomy.
 *
 * Every enum is declared once as a `readonly` const array (usable at runtime for
 * iteration, `<option>` rendering, Zod validation) and re-derived as a union type
 * (usable at the type level). Integrations (AWS / Azure / GitHub / Terraform) map
 * their native vocabularies onto these canonical values, and the UI resolves glyph
 * tints + icons from the maps at the bottom of this file.
 *
 * Keep this file free of `server-only`, database, or React imports — it is shared
 * by server integrations, API route handlers, and client components alike.
 */

/* -------------------------------------------------------------------------- */
/* Cloud providers                                                            */
/* -------------------------------------------------------------------------- */

export const CLOUD_PROVIDERS = ['aws', 'azure', 'github', 'terraform'] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

/* -------------------------------------------------------------------------- */
/* Resource kinds — the canonical "what is this thing" axis                   */
/* -------------------------------------------------------------------------- */

export const RESOURCE_KINDS = [
  'compute',
  'container',
  'database',
  'storage',
  'network',
  'cdn',
  'iam',
  'secret',
  'serverless',
  'ai',
  'monitoring',
  'registry',
  'queue',
  'repo',
  'team',
  'member',
  'unknown',
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Health / lifecycle status                                                  */
/* -------------------------------------------------------------------------- */

export const RESOURCE_STATUSES = ['healthy', 'degraded', 'stopped', 'unknown'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Terraform drift classification                                             */
/* -------------------------------------------------------------------------- */

export const DRIFT_STATUSES = [
  'in_sync',
  'drifted',
  'missing_in_cloud',
  'unmanaged',
  'unknown',
] as const;
export type DriftStatus = (typeof DRIFT_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Severity — compliance findings, security posture, alerts                   */
/* -------------------------------------------------------------------------- */

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/* -------------------------------------------------------------------------- */
/* Service category — a coarser grouping used to bucket services in the UI    */
/* (a whole "service" like ECS or Bedrock rolls many resource kinds together).*/
/* -------------------------------------------------------------------------- */

export const SERVICE_CATEGORIES = [
  'compute',
  'containers',
  'storage',
  'database',
  'networking',
  'security',
  'ai-ml',
  'observability',
  'devtools',
  'integration',
  'management',
  'other',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/* -------------------------------------------------------------------------- */
/* Pipeline stages — CI/CD graph nodes (Jenkins / GitHub Actions)             */
/* -------------------------------------------------------------------------- */

export const PIPELINE_STAGE_KINDS = [
  'source',
  'build',
  'test',
  'deploy',
  'approval',
  'other',
] as const;
export type PipelineStageKind = (typeof PIPELINE_STAGE_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Graph edge semantics — how two resources relate in the visual map          */
/* -------------------------------------------------------------------------- */

export const EDGE_KINDS = [
  'contains',
  'uses',
  'routes-to',
  'depends-on',
  'deployed-from',
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Accent tokens (from DESIGN.md) used to tint the AppIconTile glyph.         */
/* These are the ONLY saturated accents allowed on illustration/glyph tiles.  */
/* -------------------------------------------------------------------------- */

export const ACCENT_TOKENS = [
  'accent-blue',
  'accent-green',
  'accent-red',
  'accent-yellow',
  'mute',
] as const;
export type AccentToken = (typeof ACCENT_TOKENS)[number];

/**
 * Alias for the glyph-tint accent — the value `RESOURCE_KIND_ACCENT` resolves to.
 * Included so consumers (AppIconTile, ResourceNode) import one canonical name
 * instead of redeclaring a local `Accent`/`AccentToken` subset.
 */
export type GlyphAccent = AccentToken;

/**
 * Drift ring classes keyed to the canonical {@link DriftStatus}. Used by the
 * topology ResourceNode to render the signature "no blind spots" halo — green
 * in-sync / yellow drift / red missing / blue unmanaged. `in_sync` is empty so
 * the default state stays clean.
 */
export const DRIFT_RING: Record<DriftStatus, string> = {
  in_sync: "",
  drifted: "ring-2 ring-accent-yellow/60",
  missing_in_cloud: "ring-2 ring-accent-red/70 ring-offset-0",
  unmanaged: "ring-1 ring-accent-blue/50",
  unknown: "",
};

/**
 * Maps a canonical {@link ResourceKind} to a DESIGN.md accent token used to tint
 * the AppIconTile glyph. Blue = infra/compute/network, green = data/storage,
 * red = identity/secrets, yellow = compute-on-demand/AI/monitoring signals,
 * mute = source-control / org entities (kept quiet on the dark canvas).
 */
export const RESOURCE_KIND_ACCENT: Record<ResourceKind, AccentToken> = {
  compute: 'accent-blue',
  container: 'accent-blue',
  network: 'accent-blue',
  cdn: 'accent-blue',
  queue: 'accent-blue',
  database: 'accent-green',
  storage: 'accent-green',
  registry: 'accent-green',
  iam: 'accent-red',
  secret: 'accent-red',
  serverless: 'accent-yellow',
  ai: 'accent-yellow',
  monitoring: 'accent-yellow',
  repo: 'mute',
  team: 'mute',
  member: 'mute',
  unknown: 'mute',
};

/**
 * Maps a canonical {@link ResourceKind} to a `lucide-react` icon export name.
 * Kept as plain strings so this module stays free of React/icon imports; the UI
 * resolves the component (e.g. `const Icon = icons[RESOURCE_KIND_ICON[kind]]`).
 */
export const RESOURCE_KIND_ICON: Record<ResourceKind, string> = {
  compute: 'Server',
  container: 'Container',
  database: 'Database',
  storage: 'HardDrive',
  network: 'Network',
  cdn: 'Globe',
  iam: 'ShieldCheck',
  secret: 'KeyRound',
  serverless: 'Zap',
  ai: 'Sparkles',
  monitoring: 'Activity',
  registry: 'Package',
  queue: 'ListOrdered',
  repo: 'GitBranch',
  team: 'Users',
  member: 'User',
  unknown: 'CircleHelp',
};

/* -------------------------------------------------------------------------- */
/* Zod schemas mirroring the key enums (runtime validation at trust           */
/* boundaries: sync payloads, API bodies, seed data).                         */
/* -------------------------------------------------------------------------- */

/** Ergonomic aliases (shorter names used across UI components). */
export const kindAccent = RESOURCE_KIND_ACCENT;
export const kindIcon = RESOURCE_KIND_ICON;

export const zCloudProvider = z.enum(CLOUD_PROVIDERS);
export const zResourceKind = z.enum(RESOURCE_KINDS);
export const zResourceStatus = z.enum(RESOURCE_STATUSES);
export const zDriftStatus = z.enum(DRIFT_STATUSES);
export const zSeverity = z.enum(SEVERITIES);
export const zServiceCategory = z.enum(SERVICE_CATEGORIES);
export const zPipelineStageKind = z.enum(PIPELINE_STAGE_KINDS);
export const zEdgeKind = z.enum(EDGE_KINDS);
export const zAccentToken = z.enum(ACCENT_TOKENS);

/**
 * Canonicalize a free-form environment tag ("Production", "PROD", "Dev",
 * "Staging", …) into one stable facet value so estate filters never split the
 * same environment across tag-case variants.
 */
export function normalizeEnvironment(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "production" || v === "prd") return "prod";
  if (v === "development") return "dev";
  if (v === "staging" || v === "stg") return "stage";
  return v;
}
