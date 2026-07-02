import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { kbDocuments, kbChunks } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const [{ documentCount }] = await db
      .select({ documentCount: sql<number>`count(*)` })
      .from(kbDocuments);

    const [{ chunkCount }] = await db
      .select({ chunkCount: sql<number>`count(*)` })
      .from(kbChunks);

    const sources = await db
      .select({
        source: kbDocuments.source,
        count: sql<number>`count(*)`,
      })
      .from(kbDocuments)
      .groupBy(kbDocuments.source);

    const [latest] = await db
      .select({ lastIngestedAt: kbDocuments.lastIngestedAt })
      .from(kbDocuments)
      .orderBy(sql`${kbDocuments.lastIngestedAt} desc`)
      .limit(1);

    return NextResponse.json({
      ok: true,
      documentCount,
      chunkCount,
      sources,
      lastIngestedAt: latest?.lastIngestedAt?.toISOString() ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/status] failed:", err);
    return NextResponse.json({ error: "status_failed", message }, { status: 500 });
  }
}
