import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getPresignedUploadUrl } from "@/lib/kb/s3-presign";

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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";

  if (!key) {
    return NextResponse.json({ error: "key_required" }, { status: 400 });
  }

  try {
    const url = await getPresignedUploadUrl(key, contentType);
    return NextResponse.json({ ok: true, url, key });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/documents/presign] failed:", err);
    return NextResponse.json({ error: "presign_failed", message }, { status: 500 });
  }
}
