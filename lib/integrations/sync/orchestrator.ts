import { and, eq, notInArray, sql } from "drizzle-orm";
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
  return summaries;
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
    await insertSnapshots(db, syncId, discovered, now);
    await upsertEdges(db, result.edges);

    // Reconcile: mark URNs of THIS account not seen this run as absent. Skip when
    // nothing was discovered so a total failure can't wipe the last-known estate.
    if (discovered.length > 0) {
      const seen = discovered.map((r) => r.urn);
      await db
        .update(resourcesTable)
        .set({ present: false })
        .where(
          and(
            eq(resourcesTable.provider, provider),
            eq(resourcesTable.account, accountId),
            notInArray(resourcesTable.urn, seen),
          ),
        );
    }

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

async function insertSnapshots(
  db: Db,
  syncId: string,
  list: CloudResource[],
  now: Date,
): Promise<void> {
  if (list.length === 0) return;
  const rows = list.map((r) => ({
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
