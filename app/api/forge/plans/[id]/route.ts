import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { deletePlan, getPlan, updatePlanCanvas } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const zNode = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  name: z.string().min(1).max(80),
  parentId: z.string().nullable(),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
  config: z.record(z.string(), z.unknown()),
});
const zCanvas = z.object({
  nodes: z.array(zNode).max(200),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() })).max(400),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:read")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const plan = await getPlan(id).catch(() => null);
  if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: plan });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:write")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = zCanvas.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid canvas payload" }, { status: 400 });
  try {
    const plan = await updatePlanCanvas(id, parsed.data);
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    console.error("[forge] update plan failed:", err);
    return NextResponse.json({ success: false, error: "Failed to save the plan" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:write")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const plan = await getPlan(id).catch(() => null);
  if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  if (plan.status === "deployed") {
    return NextResponse.json(
      { success: false, error: "Plan has deployed resources — destroy them first" },
      { status: 409 },
    );
  }
  try {
    await deletePlan(id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    console.error("[forge] delete plan failed:", err);
    return NextResponse.json({ success: false, error: "Failed to delete the plan" }, { status: 500 });
  }
}
