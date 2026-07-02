import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import {
  accessTickets,
  ticketResources,
  ticketStatusLog,
} from "@/db/schema";
import { sendAccessDetailsEmail, type AccessDetail } from "@/lib/ticketing/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessDetailInput = { tool: string; accessMode: string; detail?: string };

/**
 * DevOps marks an approved ticket as done and triggers the access-details email.
 * The access details (optional) are emailed to the requester over SMTP.
 */
export async function POST(
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const [ticket] = await db
    .select()
    .from(accessTickets)
    .where(eq(accessTickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (ticket.status !== "approved") {
    return NextResponse.json(
      { error: "not_approved", message: "Only approved tickets can be completed." },
      { status: 409 },
    );
  }

  try {
    // Resolve access details: caller-provided override, else fall back to requested resources.
    const provided = Array.isArray(body.accessDetails)
      ? (body.accessDetails as AccessDetailInput[])
      : [];

    let accessDetails: AccessDetail[];
    if (provided.length > 0) {
      accessDetails = provided.map((d) => ({
        tool: String(d.tool ?? ""),
        accessMode: String(d.accessMode ?? ""),
        detail: d.detail == null ? undefined : String(d.detail),
      }));
    } else {
      const resources = await db
        .select()
        .from(ticketResources)
        .where(eq(ticketResources.ticketId, id));
      accessDetails = resources.map((r) => ({
        tool: r.tool,
        accessMode: r.accessMode,
        detail: r.resourceIdentity ?? undefined,
      }));
    }

    const [updated] = await db
      .update(accessTickets)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(accessTickets.id, id))
      .returning();

    await db.insert(ticketStatusLog).values({
      ticketId: id,
      fromStatus: ticket.status,
      toStatus: "done",
      actor: session.email,
    });

    // Email the requester (no-op when SMTP isn't configured).
    await sendAccessDetailsEmail(ticket.requesterEmail, updated, accessDetails);

    revalidatePath("/tickets", "layout");

    return NextResponse.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error("[api/tickets/complete] failed:", err);
    return NextResponse.json({ error: "complete_failed" }, { status: 500 });
  }
}
