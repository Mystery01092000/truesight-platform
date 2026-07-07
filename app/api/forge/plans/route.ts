import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createPlan, listPlans } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const zCreate = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:read")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ success: true, data: await listPlans() });
  } catch (err) {
    console.error("[forge] list plans failed:", err);
    return NextResponse.json({ success: false, error: "Failed to list plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "forge:write")) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  const parsed = zCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid plan payload" }, { status: 400 });
  try {
    const plan = await createPlan({ ...parsed.data, createdBy: session.email });
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err) {
    console.error("[forge] create plan failed:", err);
    return NextResponse.json({ success: false, error: "Failed to create plan" }, { status: 500 });
  }
}
