import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import {
  accessTickets,
  ticketResources,
  ticketApprovals,
  ticketStatusLog,
} from "@/db/schema";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [ticket] = await db
    .select()
    .from(accessTickets)
    .where(eq(accessTickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Non-admins can only view their own tickets.
  if (ticket.requesterEmail !== session.email && !can(session.role, "tickets:admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [resources, approvals, statusLog] = await Promise.all([
    db
      .select()
      .from(ticketResources)
      .where(eq(ticketResources.ticketId, id))
      .orderBy(desc(ticketResources.createdAt)),
    db
      .select()
      .from(ticketApprovals)
      .where(eq(ticketApprovals.ticketId, id))
      .orderBy(desc(ticketApprovals.createdAt)),
    db
      .select()
      .from(ticketStatusLog)
      .where(eq(ticketStatusLog.ticketId, id))
      .orderBy(desc(ticketStatusLog.at)),
  ]);

  return NextResponse.json({ ok: true, ticket, resources, approvals, statusLog });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "tickets:admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const status = String(body.status ?? "") as TicketStatus;
  if (!STATUS_LABELS[status]) {
    return NextResponse.json({ error: "invalid_status" }, { status: 422 });
  }

  const [existing] = await db
    .select()
    .from(accessTickets)
    .where(eq(accessTickets.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [ticket] = await db
    .update(accessTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(accessTickets.id, id))
    .returning();

  await db.insert(ticketStatusLog).values({
    ticketId: id,
    fromStatus: existing.status,
    toStatus: status,
    actor: session.email,
  });

  revalidatePath("/tickets", "layout");

  return NextResponse.json({ ok: true, ticket });
}
