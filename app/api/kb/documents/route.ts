import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { kbDocuments } from "@/db/schema";
import type { KbSourceType } from "@/lib/kb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") as KbSourceType | null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  try {
    const where = source ? eq(kbDocuments.source, source) : sql`true`;

    const documents = await db
      .select({
        id: kbDocuments.id,
        source: kbDocuments.source,
        externalId: kbDocuments.externalId,
        title: kbDocuments.title,
        url: kbDocuments.url,
        chunkCount: kbDocuments.chunkCount,
        lastIngestedAt: kbDocuments.lastIngestedAt,
        metadata: kbDocuments.metadata,
      })
      .from(kbDocuments)
      .where(where)
      .orderBy(desc(kbDocuments.lastIngestedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(kbDocuments)
      .where(where);

    return NextResponse.json({ ok: true, documents, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/documents] failed:", err);
    return NextResponse.json({ error: "list_failed", message }, { status: 500 });
  }
}
