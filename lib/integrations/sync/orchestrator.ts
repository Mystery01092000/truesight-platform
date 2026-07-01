import { createHash } from "node:crypto";

import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import {
  integrationAccounts,
  integrationSync,
  resources as resourcesTable,
  resourceSnapshots,
  resourceEdges,
} from "@/db/schema";
import type {
  AdapterError,
  CloudResource,
  GraphEdge,
  IntegrationAdapter,
} from "@/lib/integrations/types";

type Db = PostgresJsDatabase<typeof schema>;

export type SyncStatus = "ok" | "partial" | "error";

export interface SyncSummary {
  provider: string;
  account: string;
  label: string;
  status: SyncStatus;
  resourceCount: number;
  edgeCount: number;
  byKind: Record<string, number>;
  errors: AdapterError[];
}

export interface RunSyncOptions {
  adapters: IntegrationAdapter[];
  trigger: string;
  /**
   * Drizzle client. Optional so Next server code can omit it (we lazily import the
   * `server-only` `@/db` client); standalone scripts (`db/sync-cli.ts`) MUST pass
   * their own connection because `@/db` throws outside the RSC bundle.
   */
  db?: Db;
}

/** Run discovery + persistence for each adapter, sequentially, returning per-account summaries. */
export async function runSync(opts: RunSyncOptions): Promise<SyncSummary[]> {
  const db: Db = opts.db ?? ((await import("@/db")).db as unknown as Db);
  const summaries: SyncSummary[] = [];
  for (const adapter of opts.adapters) {
    summaries.push(await syncOne(db, adapter, opts.trigger));
  }
  // Announce the write over Postgres NOTIFY so any web task's SSE listener pushes an
  // "estate changed" event to live screens immediately. Cross-connection, so the
  // scheduled Fargate sync task's writes reach the web tasks too. Best-effort — a
  // NOTIFY failure must never fail the sync itself.
  await notifyEstateChanged(db, opts.trigger, summaries).catch(() => {});
  return summaries;
}

/** Publish a compact estate-change event on the `argus_estate` NOTIFY channel. */
async function notifyEstateChanged(
  db: Db,
  trigger: string,
  summaries: SyncSummary[],
): Promise<void> {
  const payload = JSON.stringify({
    type: "estate:changed",
    at: new Date().toISOString(),
    trigger,
    accounts: summaries.length,
    resources: summaries.reduce((n, s) => n + s.resourceCount, 0),
  });
  // pg_notify(channel, payload) — payload is tiny, well under Postgres' 8000-byte cap.
  await db.execute(sql`select pg_notify('argus_estate', ${payload})`);
}

/* -------------------------------------------------------------------------- */

async function syncOne(db: Db, adapter: IntegrationAdapter, trigger: string): Promise<SyncSummary> {
  // AWS adapters expose accountId/label; fall back to instanceId for any other provider.
  const meta = adapter as unknown as { accountId?: string; label?: string };
  const accountId = meta.accountId ?? adapter.instanceId;
  const label = meta.label ?? adapter.instanceId;
  const provider = adapter.provider;

  // Ensure an integration_accounts row exists (keyed by provider + externalId).
  const [acct] = await db
    .insert(integrationAccounts)
    .values({ provider, externalId: accountId, displayName: label })
    .onConflictDoUpdate({
      target: [integrationAccounts.provider, integrationAccounts.externalId],
      set: { displayName: label },
    })
    .returning({ id: integrationAccounts.id });
  const dbAccountId = acct.id;

  // Open a running sync record.
  const [run] = await db
    .insert(integrationSync)
    .values({ accountId: dbAccountId, status: "running", trigger })
    .returning({ id: integrationSync.id });
  const syncId = run.id;

  const now = new Date();

  try {
    const result = await adapter.discover();
    const discovered = result.resources;

    await upsertResources(db, discovered, now);
    await writeChangedSnapshots(db, syncId, discovered, now);
    await upsertEdges(db, result.edges);

    // Reconcile: mark resources absent that weren't seen this run — but ONLY within the
    // provider/account/region scopes that actually returned something, so a failed or
    // empty scope can never wipe another scope's estate, and an empty discovery is a
    // no-op that preserves the last-known state.
    await sweepAbsent(db, discovered);

    const status: SyncStatus = result.partial ? "partial" : "ok";
    await db
      .update(integrationSync)
      .set({
        finishedAt: new Date(),
        status,
        resourceCount: discovered.length,
        errorCount: result.errors.length,
        errors: result.errors,
      })
      .where(eq(integrationSync.id, syncId));

    return {
      provider,
      account: accountId,
      label,
      status,
      resourceCount: discovered.length,
      edgeCount: result.edges.length,
      byKind: countByKind(discovered),
      errors: result.errors,
    };
  } catch (err) {
    const adapterErr: AdapterError = {
      provider: provider as AdapterError["provider"],
      scope: "discover",
      code: (err as Error)?.name ?? "Error",
      message: (err as Error)?.message ?? String(err),
      retryable: false,
    };
    await db
      .update(integrationSync)
      .set({
        finishedAt: new Date(),
        status: "error",
        errorCount: 1,
        errors: [adapterErr],
      })
      .where(eq(integrationSync.id, syncId));

    return {
      provider,
      account: accountId,
      label,
      status: "error",
      resourceCount: 0,
      edgeCount: 0,
      byKind: {},
      errors: [adapterErr],
    };
  }
}

async function upsertResources(db: Db, list: CloudResource[], now: Date): Promise<void> {
  if (list.length === 0) return;
  const rows = list.map((r) => ({
    urn: r.urn,
    provider: r.provider,
    account: r.account,
    region: r.region,
    service: r.service,
    // `resources.type` stores the canonical ResourceKind.
    type: r.kind,
    name: r.name,
    environment: r.environment ?? null,
    status: r.status,
    tags: r.tags,
    attributes: { ...r.attributes, nativeType: r.nativeType, arn: r.arn ?? null },
    firstSeen: now,
    lastSeen: now,
    present: true,
  }));

  for (const batch of chunk(rows, 500)) {
    await db
      .insert(resourcesTable)
      .values(batch)
      .onConflictDoUpdate({
        target: resourcesTable.urn,
        set: {
          provider: sql`excluded.provider`,
          account: sql`excluded.account`,
          region: sql`excluded.region`,
          service: sql`excluded.service`,
          type: sql`excluded.type`,
          name: sql`excluded.name`,
          environment: sql`excluded.environment`,
          status: sql`excluded.status`,
          tags: sql`excluded.tags`,
          attributes: sql`excluded.attributes`,
          lastSeen: sql`excluded.last_seen`,
          present: sql`excluded.present`,
        },
      });
  }
}

/**
 * Snapshot-on-change: append a `resource_snapshots` row for a resource ONLY when it is
 * new or its captured state actually changed since its last snapshot. We derive a stable
 * content hash from the snapshot-relevant fields (excluding volatile `id`/`syncId`/
 * `capturedAt`); the same hash recomputed from the latest persisted snapshot lets us
 * detect change without a dedicated hash column. The prior hashes are fetched in bulk
 * (one query per chunk, never per-resource) so this stays O(1) round-trips per phase.
 */
async function writeChangedSnapshots(
  db: Db,
  syncId: string,
  list: CloudResource[],
  now: Date,
): Promise<void> {
  if (list.length === 0) return;

  // Latest snapshot hash per URN, resolved in bulk from the discovered URN set.
  const urns = list.map((r) => r.urn);
  const latestHash = new Map<string, string>();
  for (const batch of chunk(urns, 1000)) {
    const rows = await db
      .selectDistinctOn([resourceSnapshots.urn], {
        urn: resourceSnapshots.urn,
        provider: resourceSnapshots.provider,
        account: resourceSnapshots.account,
        region: resourceSnapshots.region,
        service: resourceSnapshots.service,
        type: resourceSnapshots.type,
        nativeType: resourceSnapshots.nativeType,
        name: resourceSnapshots.name,
        nativeId: resourceSnapshots.nativeId,
        environment: resourceSnapshots.environment,
        status: resourceSnapshots.status,
        tags: resourceSnapshots.tags,
        attributes: resourceSnapshots.attributes,
        source: resourceSnapshots.source,
      })
      .from(resourceSnapshots)
      .where(inArray(resourceSnapshots.urn, batch))
      // DISTINCT ON (urn) + this ordering keeps the most recent capture per URN.
      .orderBy(resourceSnapshots.urn, desc(resourceSnapshots.capturedAt));
    for (const row of rows) {
      // Hash the SAME field set as `resourceHashFields` (urn is the key, not hashed).
      latestHash.set(
        row.urn,
        snapshotHash({
          provider: row.provider,
          account: row.account,
          region: row.region,
          service: row.service,
          type: row.type,
          nativeType: row.nativeType,
          name: row.name,
          nativeId: row.nativeId,
          environment: row.environment,
          status: row.status,
          tags: row.tags,
          attributes: row.attributes,
          source: row.source,
        }),
      );
    }
  }

  // Keep only resources that are new or whose content hash differs from the last capture.
  const changed = list.filter((r) => {
    const prev = latestHash.get(r.urn);
    return prev === undefined || prev !== snapshotHash(resourceHashFields(r));
  });
  if (changed.length === 0) return;

  const rows = changed.map((r) => ({
    syncId,
    urn: r.urn,
    provider: r.provider,
    account: r.account,
    region: r.region,
    service: r.service,
    type: r.kind,
    nativeType: r.nativeType,
    name: r.name,
    nativeId: r.nativeId,
    environment: r.environment ?? null,
    status: r.status,
    tags: r.tags,
    attributes: r.attributes,
    source: r.source,
    capturedAt: now,
  }));
  for (const batch of chunk(rows, 500)) {
    await db.insert(resourceSnapshots).values(batch);
  }
}

/**
 * Reconcile presence per (provider, account, region) SCOPE. A resource is marked absent
 * only within scopes that returned at least one resource this run, so an empty or failed
 * scope never wipes another scope's estate. An empty discovery groups into zero scopes and
 * is therefore a no-op, preserving the last-known state.
 */
async function sweepAbsent(db: Db, discovered: CloudResource[]): Promise<void> {
  if (discovered.length === 0) return;

  const scopes = new Map<
    string,
    { provider: CloudResource["provider"]; account: string; region: string | null; urns: string[] }
  >();
  for (const r of discovered) {
    const region = r.region ?? null;
    const key = `${r.provider} ${r.account} ${region ?? ""}`;
    let scope = scopes.get(key);
    if (!scope) {
      scope = { provider: r.provider, account: r.account, region, urns: [] };
      scopes.set(key, scope);
    }
    scope.urns.push(r.urn);
  }

  for (const scope of scopes.values()) {
    await db
      .update(resourcesTable)
      .set({ present: false })
      .where(
        and(
          eq(resourcesTable.provider, scope.provider),
          eq(resourcesTable.account, scope.account),
          scope.region === null
            ? isNull(resourcesTable.region)
            : eq(resourcesTable.region, scope.region),
          notInArray(resourcesTable.urn, scope.urns),
        ),
      );
  }
}

/**
 * The snapshot-relevant fields that define a resource's captured state. Volatile fields
 * (`id`, `syncId`, `capturedAt`) are intentionally excluded so an unchanged resource
 * hashes identically across runs.
 */
interface SnapshotHashFields {
  provider: string;
  account: string | null;
  region: string | null;
  service: string | null;
  type: string | null;
  nativeType: string | null;
  name: string | null;
  nativeId: string | null;
  environment: string | null;
  status: string | null;
  tags: Record<string, string> | null;
  attributes: Record<string, unknown> | null;
  source: string | null;
}

/** Project a freshly discovered resource onto the hashable snapshot fields. */
function resourceHashFields(r: CloudResource): SnapshotHashFields {
  return {
    provider: r.provider,
    account: r.account,
    region: r.region,
    service: r.service,
    type: r.kind,
    nativeType: r.nativeType,
    name: r.name,
    nativeId: r.nativeId,
    environment: r.environment ?? null,
    status: r.status,
    tags: r.tags,
    attributes: r.attributes,
    source: r.source,
  };
}

/** Stable SHA-256 over the canonicalized snapshot fields (key order never matters). */
function snapshotHash(fields: SnapshotHashFields): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(fields))).digest("hex");
}

/** Recursively sort object keys (arrays keep order) so equal content hashes equally. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      // Postgres `jsonb` drops undefined-valued keys on write, so a persisted snapshot never
      // carries them. Mirror that here — otherwise a freshly discovered resource whose
      // attributes contain an undefined value (e.g. a standalone RDS instance's `clusterId`,
      // an EC2 instance with no `publicIp`) hashes differently from its own stored snapshot
      // and re-captures a redundant row on every single sync, defeating snapshot-on-change.
      if (obj[key] === undefined) continue;
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

async function upsertEdges(db: Db, edges: GraphEdge[]): Promise<void> {
  if (edges.length === 0) return;
  const rows = edges.map((e) => ({
    sourceUrn: e.source,
    targetUrn: e.target,
    kind: e.kind,
  }));
  for (const batch of chunk(rows, 500)) {
    await db.insert(resourceEdges).values(batch).onConflictDoNothing();
  }
}

function countByKind(list: CloudResource[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of list) out[r.kind] = (out[r.kind] ?? 0) + 1;
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
