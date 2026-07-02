import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Ticket, Search, PlusSquare, ArrowRight } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { accessTickets } from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import type { TicketStatus } from "@/lib/ticketing/types";

export const metadata: Metadata = { title: "Access Tickets" };
export const dynamic = "force-dynamic";

export default async function TicketsLandingPage() {
  const session = await getSession();
  const isAdmin = session ? can(session.role, "tickets:admin") : false;

  const tickets = session
    ? await db
        .select()
        .from(accessTickets)
        .where(eq(accessTickets.requesterEmail, session.email))
        .orderBy(desc(accessTickets.createdAt))
        .limit(10)
    : [];

  const [{ count: total }] = session
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accessTickets)
        .where(eq(accessTickets.requesterEmail, session.email))
    : [{ count: 0 }];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <Ticket size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Developer Tools Access
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Raise or track a request for AWS, Azure, Jenkins, Grafana or Superset access.
              Managed by DevOps &amp; IT.
            </p>
          </div>
        </header>
      </Reveal>

      {/* Two primary options */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Reveal>
          <Surface level={1} radius="lg" className="flex h-full flex-col p-6">
            <div className="mb-4 grid size-10 place-items-center rounded-lg border border-hairline bg-surface-card">
              <Search size={18} strokeWidth={1.75} className="text-mute" />
            </div>
            <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
              Track an existing request
            </h2>
            <p className="mt-1.5 flex-1 text-[14px] leading-[1.6] text-body">
              Follow the approval status and history of access requests you&rsquo;ve already raised.
            </p>
            <a
              href="#my-tickets"
              className={buttonClass("tertiary", "md", "mt-5 w-fit")}
            >
              View my requests
              <ArrowRight size={15} strokeWidth={1.75} />
            </a>
          </Surface>
        </Reveal>

        <Reveal delay={0.06}>
          <Surface level={1} radius="lg" className="flex h-full flex-col p-6">
            <div className="mb-4 grid size-10 place-items-center rounded-lg border border-iris bg-iris-soft">
              <PlusSquare size={18} strokeWidth={1.75} className="text-iris" />
            </div>
            <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
              Raise a new request
            </h2>
            <p className="mt-1.5 flex-1 text-[14px] leading-[1.6] text-body">
              Start a new access request. It routes to your reporting manager, then
              Peeyush, then Kamal for approval.
            </p>
            <Link href="/tickets/new" className={buttonClass("primary", "md", "mt-5 w-fit")}>
              New request
              <ArrowRight size={15} strokeWidth={1.75} />
            </Link>
          </Surface>
        </Reveal>
      </div>

      {/* My tickets */}
      <Reveal delay={0.12}>
        <section id="my-tickets" className="mt-8 scroll-mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Your requests
            </h2>
            {isAdmin && (
              <Link
                href="/tickets/admin"
                className="text-[13px] text-iris hover:text-iris-bright"
              >
                Admin console
              </Link>
            )}
          </div>

          {tickets.length === 0 ? (
            <EmptyState
              icon={<Ticket size={22} strokeWidth={1.75} />}
              title="No requests yet"
              description="Raise your first developer-tools access request to get started."
              action={
                <Link href="/tickets/new" className={buttonClass("primary", "md")}>
                  Raise a request
                </Link>
              }
            />
          ) : (
            <Surface level={1} radius="lg" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-elevated">
                      <th className="px-4 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Tools</th>
                      <th className="px-4 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Team</th>
                      <th className="px-4 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Status</th>
                      <th className="px-4 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Raised</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-hairline transition-colors last:border-0 hover:bg-surface-elevated"
                      >
                        <td className="px-4 py-3 text-[14px] leading-[1.6] text-on-dark">
                          {(t.tools as string[]).join(" · ")}
                        </td>
                        <td className="px-4 py-3 text-[14px] leading-[1.6] text-body">{t.team}</td>
                        <td className="px-4 py-3">
                          <TicketStatusBadge status={t.status as TicketStatus} />
                        </td>
                        <td className="px-4 py-3 text-[13px] text-mute">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/tickets/${t.id}`}
                            className="inline-flex items-center gap-1 text-[13px] text-iris hover:text-iris-bright"
                          >
                            View
                            <ArrowRight size={13} strokeWidth={1.75} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > tickets.length && (
                <div className="border-t border-hairline px-4 py-2.5 text-[12px] text-mute">
                  Showing {tickets.length} of {total} requests.
                </div>
              )}
            </Surface>
          )}
        </section>
      </Reveal>
    </div>
  );
}
