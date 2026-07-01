import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// Type-only imports from the canonical taxonomy. These are erased at build time
// (verbatimModuleSyntax=false) so drizzle-kit never needs to resolve the alias —
// they only sharpen the `jsonb`/`text` column value types.
import type {
  CloudProvider,
  DriftStatus,
  EdgeKind,
  ResourceStatus,
  Severity,
} from '../lib/taxonomy';

/**
 * Argus Drizzle schema (PostgreSQL).
 *
 * Conventions:
 *  - UUID primary keys via `defaultRandom()` (except `resources`, keyed by URN).
 *  - All timestamps are `timestamptz` (`timestamp({ withTimezone: true })`).
 *  - Flexible provider payloads live in `jsonb` columns, narrowed with `$type<>`.
 *  - Column DB names are explicit snake_case; the TS keys stay camelCase.
 */

/* -------------------------------------------------------------------------- */
/* Auth / platform users                                                      */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('viewer'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/* Integration accounts (an AWS account, Azure subscription, GitHub org, ...)  */
/* -------------------------------------------------------------------------- */

export const integrationAccounts = pgTable(
  'integration_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').$type<CloudProvider>().notNull(),
    externalId: text('external_id').notNull(),
    displayName: text('display_name'),
    ssmPath: text('ssm_path'),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('integration_accounts_provider_external_uq').on(t.provider, t.externalId),
    index('integration_accounts_provider_idx').on(t.provider),
  ],
);

/* -------------------------------------------------------------------------- */
/* Integration sync runs                                                      */
/* -------------------------------------------------------------------------- */

export const integrationSync = pgTable(
  'integration_sync',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => integrationAccounts.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull().default('running'),
    resourceCount: integer('resource_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    errors: jsonb('errors').$type<unknown[]>(),
    trigger: text('trigger'),
  },
  (t) => [
    index('integration_sync_account_idx').on(t.accountId),
    index('integration_sync_started_idx').on(t.startedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Resource snapshots — append-only capture history                           */
/* -------------------------------------------------------------------------- */

export const resourceSnapshots = pgTable(
  'resource_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    syncId: uuid('sync_id').references(() => integrationSync.id, { onDelete: 'cascade' }),
    urn: text('urn').notNull(),
    provider: text('provider').$type<CloudProvider>().notNull(),
    account: text('account'),
    region: text('region'),
    service: text('service'),
    type: text('type'),
    nativeType: text('native_type'),
    name: text('name'),
    nativeId: text('native_id'),
    environment: text('environment'),
    status: text('status').$type<ResourceStatus>(),
    tags: jsonb('tags').$type<Record<string, string>>(),
    attributes: jsonb('attributes').$type<Record<string, unknown>>(),
    source: text('source'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('resource_snapshots_urn_idx').on(t.urn),
    index('resource_snapshots_sync_idx').on(t.syncId),
    index('resource_snapshots_provider_idx').on(t.provider),
    index('resource_snapshots_captured_idx').on(t.capturedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Resources — materialized "current" view, keyed by URN                      */
/* -------------------------------------------------------------------------- */

export const resources = pgTable(
  'resources',
  {
    urn: text('urn').primaryKey(),
    provider: text('provider').$type<CloudProvider>().notNull(),
    account: text('account'),
    region: text('region'),
    service: text('service'),
    type: text('type'),
    name: text('name'),
    environment: text('environment'),
    status: text('status').$type<ResourceStatus>(),
    tags: jsonb('tags').$type<Record<string, string>>(),
    attributes: jsonb('attributes').$type<Record<string, unknown>>(),
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    present: boolean('present').notNull().default(true),
  },
  (t) => [
    index('resources_provider_idx').on(t.provider),
    index('resources_environment_idx').on(t.environment),
    index('resources_service_idx').on(t.service),
    index('resources_status_idx').on(t.status),
    // GIN index for containment/key queries over the tags jsonb (Postgres jsonb_ops).
    index('resources_tags_gin_idx').using('gin', t.tags),
  ],
);

/* -------------------------------------------------------------------------- */
/* Resource edges — the visual map graph                                      */
/* -------------------------------------------------------------------------- */

export const resourceEdges = pgTable(
  'resource_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceUrn: text('source_urn').notNull(),
    targetUrn: text('target_urn').notNull(),
    kind: text('kind').$type<EdgeKind>().notNull(),
    attributes: jsonb('attributes').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('resource_edges_triple_uq').on(t.sourceUrn, t.targetUrn, t.kind),
    index('resource_edges_source_idx').on(t.sourceUrn),
    index('resource_edges_target_idx').on(t.targetUrn),
  ],
);

/* -------------------------------------------------------------------------- */
/* Compliance findings                                                        */
/* -------------------------------------------------------------------------- */

export const complianceFindings = pgTable(
  'compliance_findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    urn: text('urn'),
    ruleId: text('rule_id').notNull(),
    framework: text('framework'),
    title: text('title'),
    description: text('description'),
    remediation: text('remediation'),
    severity: text('severity').$type<Severity>(),
    status: text('status').notNull().default('fail'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('compliance_findings_urn_idx').on(t.urn),
    index('compliance_findings_severity_idx').on(t.severity),
    index('compliance_findings_rule_idx').on(t.ruleId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Security posture                                                           */
/* -------------------------------------------------------------------------- */

export const securityPosture = pgTable(
  'security_posture',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    urn: text('urn'),
    provider: text('provider').$type<CloudProvider>(),
    category: text('category'),
    title: text('title'),
    severity: text('severity').$type<Severity>(),
    exposed: boolean('exposed').notNull().default(false),
    score: integer('score'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('security_posture_urn_idx').on(t.urn),
    index('security_posture_severity_idx').on(t.severity),
  ],
);

/* -------------------------------------------------------------------------- */
/* Drift findings (Terraform vs. cloud)                                        */
/* -------------------------------------------------------------------------- */

export const driftFindings = pgTable(
  'drift_findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    urn: text('urn').notNull(),
    env: text('env'),
    module: text('module'),
    classification: text('classification').$type<DriftStatus>().notNull(),
    diff: jsonb('diff').$type<Record<string, unknown>>(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('drift_findings_urn_idx').on(t.urn),
    index('drift_findings_classification_idx').on(t.classification),
    index('drift_findings_env_idx').on(t.env),
  ],
);

/* -------------------------------------------------------------------------- */
/* Cost snapshots                                                             */
/* -------------------------------------------------------------------------- */

export const costSnapshots = pgTable(
  'cost_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').$type<CloudProvider>().notNull(),
    account: text('account'),
    service: text('service'),
    tagProduct: text('tag_product'),
    amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    granularity: text('granularity').notNull().default('DAILY'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('cost_snapshots_provider_idx').on(t.provider),
    index('cost_snapshots_service_idx').on(t.service),
    index('cost_snapshots_period_idx').on(t.periodStart),
    index('cost_snapshots_product_idx').on(t.tagProduct),
  ],
);

/* -------------------------------------------------------------------------- */
/* Checklists                                                                 */
/* -------------------------------------------------------------------------- */

export const checklists = pgTable('checklists', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    done: boolean('done').notNull().default(false),
    severity: text('severity').$type<Severity>(),
    position: integer('position').notNull().default(0),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('checklist_items_checklist_idx').on(t.checklistId)],
);

/* -------------------------------------------------------------------------- */
/* Dashboards & widgets                                                       */
/* -------------------------------------------------------------------------- */

export const dashboards = pgTable('dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  layout: jsonb('layout').$type<Record<string, unknown>>(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const widgets = pgTable(
  'widgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dashboardId: uuid('dashboard_id')
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    position: jsonb('position').$type<{ x: number; y: number; w: number; h: number }>(),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('widgets_dashboard_idx').on(t.dashboardId)],
);

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Inferred row types                                                         */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type IntegrationAccount = typeof integrationAccounts.$inferSelect;
export type NewIntegrationAccount = typeof integrationAccounts.$inferInsert;

export type IntegrationSync = typeof integrationSync.$inferSelect;
export type NewIntegrationSync = typeof integrationSync.$inferInsert;

export type ResourceSnapshot = typeof resourceSnapshots.$inferSelect;
export type NewResourceSnapshot = typeof resourceSnapshots.$inferInsert;

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

export type ResourceEdge = typeof resourceEdges.$inferSelect;
export type NewResourceEdge = typeof resourceEdges.$inferInsert;

export type ComplianceFinding = typeof complianceFindings.$inferSelect;
export type NewComplianceFinding = typeof complianceFindings.$inferInsert;

export type SecurityPosture = typeof securityPosture.$inferSelect;
export type NewSecurityPosture = typeof securityPosture.$inferInsert;

export type DriftFinding = typeof driftFindings.$inferSelect;
export type NewDriftFinding = typeof driftFindings.$inferInsert;

export type CostSnapshot = typeof costSnapshots.$inferSelect;
export type NewCostSnapshot = typeof costSnapshots.$inferInsert;

export type Checklist = typeof checklists.$inferSelect;
export type NewChecklist = typeof checklists.$inferInsert;

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;

export type Widget = typeof widgets.$inferSelect;
export type NewWidget = typeof widgets.$inferInsert;

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
