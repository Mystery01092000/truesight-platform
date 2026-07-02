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
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import { StatusTimeline, type TimelineEntry } from "@/components/ticketing/StatusTimeline";
import { TicketActions } from "@/components/ticketing/TicketActions";
import { TOOL_LABELS, STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

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
  const timeline: TimelineEntry[] = statusLog.map((l) => ({
    fromStatus: l.fromStatus,
    toStatus: l.toStatus,
    actor: l.actor,
    at: l.at,
  }));

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
                  const tone = !a.decision
                    ? "text-mute"
                    : a.decision === "approved"
                      ? "text-accent-green"
                      : "text-accent-red";
                  return (
                    <li
                      key={a.id}
                      className="flex items-start justify-between gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium capitalize text-on-dark">
                          {a.approverRole}
                        </div>
                        {a.decidedAt && (
                          <div className="text-[12px] text-ash">
                            {new Date(a.decidedAt).toLocaleString()}
                          </div>
                        )}
                        {a.notes && <div className="mt-1 text-[12px] text-mute">{a.notes}</div>}
                      </div>
                      <span className={`text-[12px] font-medium capitalize ${tone}`}>
                        {a.decision ?? "pending"}
                      </span>
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
              <StatusTimeline entries={timeline} />
            </Surface>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
