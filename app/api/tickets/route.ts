import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { desc, eq, sql, and } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import {
  accessTickets,
  ticketResources,
  ticketApprovals,
  ticketStatusLog,
} from "@/db/schema";
import { isTool, isAccessMode, type TicketStatus } from "@/lib/ticketing/types";
import { buildRequestCard, notifyTeams } from "@/lib/ticketing/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Access tickets — list (GET) and create (POST).
 * Any authenticated user can list their own tickets and raise new ones;
 * operators/admins can list every ticket.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "1" || searchParams.get("mine") === "true";
  const admin = can(session.role, "tickets:admin");

  try {
    const conditions = [];
    // Non-admins only ever see their own tickets unless explicitly requesting all (still gated).
    if (!admin || mine) {
      conditions.push(eq(accessTickets.requesterEmail, session.email));
    }
    if (status) conditions.push(eq(accessTickets.status, status));

    const where = conditions.length ? and(...conditions) : sql`true`;

    const tickets = await db
      .select()
      .from(accessTickets)
      .where(where)
      .orderBy(desc(accessTickets.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, tickets });
  } catch (err) {
    console.error("[api/tickets] list failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

const TIMELINE_VALUES = ["1 week", "2 weeks", "1 month", "3 months", "custom"];

type ResourceInput = { tool: string; accessMode: string; resourceIdentity?: string };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // ---- Required-field validation -------------------------------------------
  const errors: string[] = [];
  const name = String(body.name ?? "").trim();
  const team = String(body.team ?? "").trim();
  const project = String(body.project ?? "").trim();
  const reportingManager = String(body.reportingManager ?? "").trim();
  const toolsRaw = Array.isArray(body.tools) ? (body.tools as unknown[]).map(String) : [];
  const tools = toolsRaw.filter(isTool);
  const purpose = body.purpose == null ? null : String(body.purpose).trim() || null;
  const timeline = String(body.timeline ?? "").trim();
  const timelineCustom =
    timeline === "custom" && body.timelineCustom ? String(body.timelineCustom).trim() : null;
  const vpnAccess = body.vpnAccess === true || body.vpnAccess === "true";
  const vpnMacAddress = vpnAccess && body.vpnMacAddress ? String(body.vpnMacAddress).trim() : null;
  const managerApproved = body.managerApproved === true || body.managerApproved === "true";
  const resourcesRaw = Array.isArray(body.resources) ? (body.resources as ResourceInput[]) : [];

  if (!name) errors.push("name is required");
  if (!team) errors.push("team is required");
  if (!project) errors.push("project is required");
  if (!reportingManager) errors.push("reportingManager is required");
  if (tools.length === 0) errors.push("at least one tool is required");
  if (!timeline) errors.push("timeline is required");
  else if (!TIMELINE_VALUES.includes(timeline)) errors.push("invalid timeline value");
  if (timeline === "custom" && !timelineCustom) errors.push("timelineCustom is required for custom timeline");
  if (vpnAccess && !vpnMacAddress) errors.push("vpnMacAddress is required when VPN access is yes");
  if (!managerApproved) errors.push("managerApproved must be yes");

  const resources = resourcesRaw
    .filter((r) => isTool(r.tool) && isAccessMode(r.accessMode))
    .map((r) => ({
      tool: r.tool as string,
      accessMode: r.accessMode as string,
      resourceIdentity: r.resourceIdentity?.trim() || null,
    }));

  // Every selected tool must declare at least one access mode.
  const toolsWithMode = new Set(resources.map((r) => r.tool));
  for (const t of tools) {
    if (!toolsWithMode.has(t)) errors.push(`access mode required for tool ${t}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "validation_failed", errors }, { status: 422 });
  }

  // ---- Persist ticket + relations ------------------------------------------
  try {
    const [ticket] = await db
      .insert(accessTickets)
      .values({
        requesterEmail: session.email,
        requesterName: name,
        team,
        project,
        reportingManager,
        tools,
        purpose,
        timeline,
        timelineCustom,
        vpnAccess,
        vpnMacAddress: vpnMacAddress ?? null,
        managerApproved,
        status: "peeyush_review" as TicketStatus,
      })
      .returning();

    if (resources.length > 0) {
      await db.insert(ticketResources).values(
        resources.map((r) => ({
          ticketId: ticket.id,
          tool: r.tool,
          accessMode: r.accessMode,
          resourceIdentity: r.resourceIdentity,
        })),
      );
    }

    // Seed the first approval record (pending decision for @peeyush).
    await db.insert(ticketApprovals).values({
      ticketId: ticket.id,
      approverRole: "peeyush",
      approverEmail: null,
      decision: null,
      decidedAt: null,
      notes: null,
    });

    await db.insert(ticketStatusLog).values({
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: "peeyush_review",
      actor: session.email,
    });

    // Notify @peeyush via Teams (no-op when unconfigured).
    await notifyTeams(buildRequestCard(ticket));

    revalidatePath("/tickets", "layout");

    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (err) {
    console.error("[api/tickets] create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
