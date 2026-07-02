import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { kbDocuments, kbChunks, kbEmbeddings } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db.transaction(async (tx) => {
      const chunks = await tx
        .select({ id: kbChunks.id })
        .from(kbChunks)
        .where(eq(kbChunks.documentId, id));

      const chunkIds = chunks.map((c) => c.id);
      if (chunkIds.length > 0) {
        await tx.delete(kbEmbeddings).where(inArray(kbEmbeddings.chunkId, chunkIds));
        await tx.delete(kbChunks).where(eq(kbChunks.documentId, id));
      }
      await tx.delete(kbDocuments).where(eq(kbDocuments.id, id));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/documents/[id]] failed:", err);
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 });
  }
}
