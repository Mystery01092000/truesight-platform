import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe for the ALB / ECS health check and the Jenkins smoke test.
 * Unauthenticated by design (excluded in middleware). Reports DB reachability.
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "ok" : "unreachable",
    service: "truesight",
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
