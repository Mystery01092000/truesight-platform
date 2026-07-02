import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, desc } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import {
  accessTickets,
  ticketApprovals,
  ticketStatusLog,
} from "@/db/schema";
import { buildApprovalCard, notifyTeams } from "@/lib/ticketing/teams";
import type { ApprovalDecision, TicketStatus } from "@/lib/ticketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS: ApprovalDecision[] = ["approved", "declined", "need_more_info"];

/**
 * Process an approval decision on a ticket. The status machine advances:
 *  - peeyush approves → kamal_review + notify @kamal
 *  - peeyush declines / need_more_info → declined
 *  - kamal approves → approved (ready for DevOps)
 *  - kamal declines / need_more_info → declined
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const decision = String(body.decision ?? "") as ApprovalDecision;
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "invalid_decision" }, { status: 422 });
  }
  const notes = body.notes == null ? null : String(body.notes).trim() || null;

  const [ticket] = await db
    .select()
    .from(accessTickets)
    .where(eq(accessTickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Resolve which approval stage this ticket is in.
  const status = ticket.status as TicketStatus;
  const isPeeyushStage = status === "peeyush_review";
  const isKamalStage = status === "kamal_review";

  if (!isPeeyushStage && !isKamalStage) {
    return NextResponse.json(
      { error: "not_in_review", message: "Ticket is not awaiting an approval decision." },
      { status: 409 },
    );
  }

  const approverRole = isPeeyushStage ? "peeyush" : "kamal";

  // ---- Advance the status machine ------------------------------------------
  let nextStatus: TicketStatus;
  if (decision === "approved") {
    nextStatus = isPeeyushStage ? "kamal_review" : "approved";
  } else {
    // declined + need_more_info both park the ticket.
    nextStatus = "declined";
  }

  try {
    // Record the decision on the pending approval row for this stage.
    const [pending] = await db
      .select()
      .from(ticketApprovals)
      .where(
        and(eq(ticketApprovals.ticketId, id), eq(ticketApprovals.approverRole, approverRole)),
      )
      .orderBy(desc(ticketApprovals.createdAt))
      .limit(1);

    if (pending) {
      await db
        .update(ticketApprovals)
        .set({ decision, decidedAt: new Date(), notes, approverEmail: session.email })
        .where(eq(ticketApprovals.id, pending.id));
    } else {
      await db.insert(ticketApprovals).values({
        ticketId: id,
        approverRole,
        approverEmail: session.email,
        decision,
        decidedAt: new Date(),
        notes,
      });
    }

    // If peeyush approves, seed the kamal approval record.
    if (isPeeyushStage && decision === "approved") {
      await db.insert(ticketApprovals).values({
        ticketId: id,
        approverRole: "kamal",
        decision: null,
      });
    }

    const [updated] = await db
      .update(accessTickets)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(accessTickets.id, id))
      .returning();

    await db.insert(ticketStatusLog).values({
      ticketId: id,
      fromStatus: status,
      toStatus: nextStatus,
      actor: session.email,
    });

    // Notify @kamal when advancing to their stage.
    if (nextStatus === "kamal_review") {
      await notifyTeams(buildApprovalCard(updated, "kamal"));
    }

    revalidatePath("/tickets", "layout");

    return NextResponse.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error("[api/tickets/approve] failed:", err);
    return NextResponse.json({ error: "approve_failed" }, { status: 500 });
  }
}
