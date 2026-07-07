import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { startRun } from "@/lib/forge/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const zRun = z.object({ kind: z.enum(["plan", "apply", "destroy"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  const parsed = zRun.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid run payload" }, { status: 400 });

  const requiredAction = parsed.data.kind === "plan" ? "forge:write" : "forge:deploy";
  if (!can(session.role, requiredAction)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await startRun({ planId: id, kind: parsed.data.kind, triggeredBy: session.email });
    if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, data: result }, { status: 202 });
  } catch (err) {
    console.error("[forge] run failed to start:", err);
    return NextResponse.json({ success: false, error: "Failed to start the run" }, { status: 500 });
  }
}
