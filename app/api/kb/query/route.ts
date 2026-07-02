import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { queryKb } from "@/lib/kb/retrieval";
import type { KbSourceType } from "@/lib/kb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query_required" }, { status: 400 });
  }

  const limit = typeof body.limit === "number" ? Math.min(body.limit, 50) : 10;
  const sources = Array.isArray(body.sources)
    ? body.sources.filter((s): s is KbSourceType => typeof s === "string")
    : undefined;
  const provider = typeof body.provider === "string" ? body.provider : undefined;

  try {
    const results = await queryKb(query, { limit, sources, provider });
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/query] failed:", err);
    return NextResponse.json({ error: "query_failed", message }, { status: 500 });
  }
}
