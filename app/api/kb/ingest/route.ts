import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { runKbIngest } from "@/lib/kb/ingest";
import type { KbSourceType } from "@/lib/kb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine; defaults to all sources.
  }

  const sources = Array.isArray(body.sources)
    ? (body.sources.filter((s) => typeof s === "string") as KbSourceType[])
    : undefined;
  const all = body.all === true || !sources || sources.length === 0;

  try {
    const result = await runKbIngest({ sources, all });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/ingest] failed:", err);
    return NextResponse.json({ error: "ingest_failed", message }, { status: 500 });
  }
}
