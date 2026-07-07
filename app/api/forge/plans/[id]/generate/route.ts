import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getPlan, setPlanGenerated } from "@/lib/forge/store";
import { generateTf } from "@/lib/forge/terraform";
import { renderHclPreview } from "@/lib/forge/hcl-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:write")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const plan = await getPlan(id).catch(() => null);
  if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

  try {
    const { tf, issues } = generateTf(plan.canvasJson);
    if (!tf) return NextResponse.json({ success: false, data: { issues }, error: "Canvas has validation issues" }, { status: 422 });
    await setPlanGenerated(id, tf);
    return NextResponse.json({ success: true, data: { tf, hcl: renderHclPreview(tf), issues: [] } });
  } catch (err) {
    console.error("[forge] generate failed:", err);
    return NextResponse.json({ success: false, error: "Terraform generation failed" }, { status: 500 });
  }
}
