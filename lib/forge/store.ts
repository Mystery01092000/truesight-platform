import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { forgePlans, forgeRuns } from "@/db/schema";
import type { ForgeCanvas, ForgePlanStatus, ForgeRunKind } from "./types";

export type ForgePlanRow = typeof forgePlans.$inferSelect;
export type ForgeRunRow = typeof forgeRuns.$inferSelect;

const STALE_RUN_MS = 30 * 60 * 1000;

export async function listPlans(): Promise<ForgePlanRow[]> {
  return db.select().from(forgePlans).orderBy(desc(forgePlans.updatedAt));
}

export async function getPlan(id: string): Promise<ForgePlanRow | null> {
  const rows = await db.select().from(forgePlans).where(eq(forgePlans.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPlan(input: { name: string; description?: string; createdBy: string }): Promise<ForgePlanRow> {
  const rows = await db
    .insert(forgePlans)
    .values({
      name: input.name,
      description: input.description ?? null,
      canvasJson: { nodes: [], edges: [] },
      createdBy: input.createdBy,
    })
    .returning();
  return rows[0]!;
}

export async function updatePlanCanvas(id: string, canvas: ForgeCanvas): Promise<ForgePlanRow | null> {
  const rows = await db
    .update(forgePlans)
    .set({ canvasJson: canvas, status: "draft", version: sql`${forgePlans.version} + 1`, updatedAt: new Date() })
    .where(eq(forgePlans.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function setPlanGenerated(id: string, tf: Record<string, unknown>): Promise<void> {
  await db.update(forgePlans).set({ tfJson: tf, status: "generated", updatedAt: new Date() }).where(eq(forgePlans.id, id));
}

export async function setPlanStatus(id: string, status: ForgePlanStatus): Promise<void> {
  await db.update(forgePlans).set({ status, updatedAt: new Date() }).where(eq(forgePlans.id, id));
}

export async function deletePlan(id: string): Promise<void> {
  await db.delete(forgePlans).where(eq(forgePlans.id, id));
}

export async function snapshotState(planId: string, tfState: string): Promise<void> {
  await db.update(forgePlans).set({ tfState }).where(eq(forgePlans.id, planId));
}

export async function createRun(planId: string, kind: ForgeRunKind, triggeredBy: string): Promise<ForgeRunRow> {
  const rows = await db.insert(forgeRuns).values({ planId, kind, triggeredBy }).returning();
  return rows[0]!;
}

export async function appendRunLog(runId: string, chunk: string): Promise<void> {
  await db.update(forgeRuns).set({ log: sql`${forgeRuns.log} || ${chunk}` }).where(eq(forgeRuns.id, runId));
}

export async function finishRun(runId: string, status: "succeeded" | "failed", exitCode: number | null): Promise<void> {
  await db.update(forgeRuns).set({ status, exitCode, finishedAt: new Date() }).where(eq(forgeRuns.id, runId));
}

export async function getRun(runId: string): Promise<ForgeRunRow | null> {
  const rows = await db.select().from(forgeRuns).where(eq(forgeRuns.id, runId)).limit(1);
  return rows[0] ?? null;
}

export async function listRuns(planId: string): Promise<ForgeRunRow[]> {
  return db.select().from(forgeRuns).where(eq(forgeRuns.planId, planId)).orderBy(desc(forgeRuns.startedAt));
}

/** Active run for a plan; sweeps runs that died without finishing (stale > 30 min). */
export async function getActiveRun(planId: string): Promise<ForgeRunRow | null> {
  await db
    .update(forgeRuns)
    .set({ status: "failed", finishedAt: new Date() })
    .where(and(eq(forgeRuns.status, "running"), lt(forgeRuns.startedAt, new Date(Date.now() - STALE_RUN_MS))));
  const rows = await db
    .select()
    .from(forgeRuns)
    .where(and(eq(forgeRuns.planId, planId), eq(forgeRuns.status, "running")))
    .limit(1);
  return rows[0] ?? null;
}
