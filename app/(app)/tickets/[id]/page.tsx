import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Ticket } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { accessTickets, ticketResources, ticketApprovals, ticketStatusLog } from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import { TicketActions } from "@/components/ticketing/TicketActions";
import { TOOL_LABELS, STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

/** Semantic rail-dot color per resulting status (matches TicketStatusBadge). */
const STATUS_DOT: Record<TicketStatus, string> = {
  pending: "bg-warning",
  peeyush_review: "bg-info",
  kamal_review: "bg-info",
  approved: "bg-positive",
  declined: "bg-critical",
  done: "bg-positive",
};

function transitionText(fromStatus: string | null, toStatus: string): string {
  const to = STATUS_LABELS[toStatus as TicketStatus] ?? toStatus;
  if (!fromStatus) return `Ticket opened at ${to}.`;
  const from = STATUS_LABELS[fromStatus as TicketStatus] ?? fromStatus;
  return `Moved from ${from} to ${to}.`;
}

const DECISION_TONE: Record<string, string> = {
  approved: "bg-positive-soft text-positive",
  declined: "bg-critical-soft text-critical",
  need_more_info: "bg-warning-soft text-warning",
  pending: "bg-surface-elevated text-mute",
};

const DECISION_LABEL: Record<string, string> = {
  approved: "Approved",
  declined: "Declined",
  need_more_info: "More info",
  pending: "Pending",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ticket ${id.slice(0, 8)}` };
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const [ticket] = await db
    .select()
    .from(accessTickets)
    .where(eq(accessTickets.id, id))
    .limit(1);

  if (!ticket) notFound();

  const isAdmin = can(session.role, "tickets:admin");
  if (ticket.requesterEmail !== session.email && !isAdmin) notFound();

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

  const status = ticket.status as TicketStatus;
  const timelineItems: TimelineItem[] = statusLog.map((l, i) => {
    const at = l.at instanceof Date ? l.at : new Date(l.at);
    return {
      id: i,
      marker: (
        <span
          className={`block size-2.5 rounded-full border-2 border-surface ${
            STATUS_DOT[l.toStatus as TicketStatus] ?? "bg-hairline-strong"
          }`}
        />
      ),
      title: (
        <>
          <TicketStatusBadge status={l.toStatus as TicketStatus} />
          <span className="font-mono text-[12px] text-ash">
            {l.actor ? `by ${l.actor}` : "system"}
          </span>
        </>
      ),
      timestamp: at.toLocaleString(),
      body: transitionText(l.fromStatus, l.toStatus),
    };
  });

  // The current reviewer can act when the ticket is in their stage.
  const canApprove = isAdmin && (status === "peeyush_review" || status === "kamal_review");

  const facts: { label: string; value: string }[] = [
    { label: "Requester", value: `${ticket.requesterName} (${ticket.requesterEmail})` },
    { label: "Team", value: ticket.team },
    { label: "Project", value: ticket.project },
    { label: "Reporting Manager", value: ticket.reportingManager },
    { label: "Tools", value: (ticket.tools as string[]).map((t) => TOOL_LABELS[t as keyof typeof TOOL_LABELS] ?? t).join(", ") },
    { label: "Timeline", value: ticket.timelineCustom ? `${ticket.timeline} (${ticket.timelineCustom})` : ticket.timeline },
    { label: "Purpose", value: ticket.purpose ?? "—" },
    { label: "VPN access", value: ticket.vpnAccess ? `Yes — ${ticket.vpnMacAddress ?? "—"}` : "No" },
    { label: "Manager approved", value: ticket.managerApproved ? "Yes" : "No" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <div className="mb-4 flex items-center gap-2">
          <Link href="/tickets" className={buttonClass("secondary", "sm")}>
            <ArrowLeft size={14} strokeWidth={1.75} />
            Tickets
          </Link>
        </div>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
              aria-hidden
            >
              <Ticket size={22} strokeWidth={1.75} className="text-iris" />
            </span>
            <div>
              <h1 className="text-[22px] font-medium leading-[1.3] tracking-[0.2px] text-ink">
                {(ticket.tools as string[]).join(" · ")} access
              </h1>
              <p className="mt-1 font-mono text-[12px] text-ash">
                {ticket.id} · raised {new Date(ticket.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <TicketStatusBadge status={status} />
        </header>
      </Reveal>

      {/* Actions */}
      <Reveal delay={0.04}>
        <Surface level={1} radius="lg" className="mb-4 p-4">
          <TicketActions ticketId={ticket.id} canApprove={canApprove} isAdmin={isAdmin} status={status} />
        </Surface>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details + resources */}
        <div className="space-y-4 lg:col-span-2">
          <Reveal delay={0.08}>
            <Surface level={1} radius="lg" className="p-6">
              <h2 className="mb-4 text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Request details
              </h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {facts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-[12px] uppercase tracking-[0.4px] text-mute">{f.label}</dt>
                    <dd className="mt-0.5 break-words text-[14px] leading-[1.5] text-body">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Surface>
          </Reveal>

          <Reveal delay={0.12}>
            <Surface level={1} radius="lg" className="p-6">
              <h2 className="mb-4 text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Resources requested
              </h2>
              <div className="overflow-hidden rounded-md border border-hairline">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-elevated">
                      <th className="px-3.5 py-2 text-[13px] font-medium tracking-[0.2px] text-mute">Tool</th>
                      <th className="px-3.5 py-2 text-[13px] font-medium tracking-[0.2px] text-mute">Access</th>
                      <th className="px-3.5 py-2 text-[13px] font-medium tracking-[0.2px] text-mute">Resource</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3.5 py-8 text-center text-[14px] text-mute">
                          No scoped resources.
                        </td>
                      </tr>
                    ) : (
                      resources.map((r) => (
                        <tr key={r.id} className="border-b border-hairline last:border-0">
                          <td className="px-3.5 py-2.5 text-[14px] text-on-dark">
                            {TOOL_LABELS[r.tool as keyof typeof TOOL_LABELS] ?? r.tool}
                          </td>
                          <td className="px-3.5 py-2.5 text-[14px] capitalize text-body">{r.accessMode}</td>
                          <td className="px-3.5 py-2.5 font-mono text-[13px] text-body">
                            {r.resourceIdentity ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Surface>
          </Reveal>
        </div>

        {/* Approval chain + timeline */}
        <div className="space-y-4">
          <Reveal delay={0.1}>
            <Surface level={1} radius="lg" className="p-6">
              <h2 className="mb-4 text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Approval chain
              </h2>
              <ol className="space-y-3">
                {approvals.map((a) => {
                  const decision = a.decision ?? "pending";
                  return (
                    <li key={a.id}>
                      <Surface level={2} radius="md" className="p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] font-medium capitalize leading-[1.5] text-on-dark">
                            {a.approverRole}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-xs px-2 py-0.5 text-[12px] leading-[1.5] tracking-[0.4px] ${
                              DECISION_TONE[decision] ?? DECISION_TONE.pending
                            }`}
                          >
                            {DECISION_LABEL[decision] ?? decision}
                          </span>
                        </div>
                        {a.decidedAt && (
                          <div className="mt-1 font-mono text-[12px] tabular-nums text-ash">
                            {new Date(a.decidedAt).toLocaleString()}
                          </div>
                        )}
                        {a.notes && (
                          <p className="mt-2 border-t border-hairline pt-2 text-[13px] leading-[1.5] text-mute">
                            {a.notes}
                          </p>
                        )}
                      </Surface>
                    </li>
                  );
                })}
                {approvals.length === 0 && (
                  <li className="text-[13px] text-mute">No approvals recorded.</li>
                )}
              </ol>
            </Surface>
          </Reveal>

          <Reveal delay={0.14}>
            <Surface level={1} radius="lg" className="p-6">
              <h2 className="mb-4 text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Status timeline
              </h2>
              <Timeline
                variant="status"
                items={timelineItems}
                emptyMessage="No status transitions recorded yet."
              />
            </Surface>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
