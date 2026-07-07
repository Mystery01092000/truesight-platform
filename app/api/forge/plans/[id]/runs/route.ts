import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getActiveRun, listRuns } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:read")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json({ success: true, data: { runs: await listRuns(id), active: await getActiveRun(id) } });
  } catch (err) {
    console.error("[forge] list runs failed:", err);
    return NextResponse.json({ success: false, error: "Failed to list runs" }, { status: 500 });
  }
}
