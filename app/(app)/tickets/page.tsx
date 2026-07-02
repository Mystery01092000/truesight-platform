import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Ticket, PlusSquare } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { accessTickets } from "@/db/schema";
import { Reveal } from "@/components/ui/Reveal";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TicketsExplorer, type MyTicket } from "@/components/ticketing/TicketsExplorer";
import type { TicketStatus } from "@/lib/ticketing/types";

export const metadata: Metadata = { title: "Access Tickets" };
export const dynamic = "force-dynamic";

export default async function TicketsLandingPage() {
  const session = await getSession();
  const isAdmin = session ? can(session.role, "tickets:admin") : false;

  const rows = session
    ? await db
        .select()
        .from(accessTickets)
        .where(eq(accessTickets.requesterEmail, session.email))
        .orderBy(desc(accessTickets.createdAt))
        .limit(500)
    : [];

  const tickets: MyTicket[] = rows.map((r) => ({
    id: r.id,
    requesterName: r.requesterName,
    team: r.team,
    tools: r.tools as string[],
    status: r.status as TicketStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
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
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/tickets/admin"
                className="text-[13px] text-iris transition-colors duration-150 ease-smooth hover:text-iris-bright"
              >
                Admin console
              </Link>
            )}
            <Link href="/tickets/new" className={buttonClass("primary", "md")}>
              <PlusSquare size={15} strokeWidth={1.75} />
              New request
            </Link>
          </div>
        </header>
      </Reveal>

      {tickets.length === 0 ? (
        <Reveal delay={0.06}>
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
        </Reveal>
      ) : (
        <Reveal delay={0.06}>
          <TicketsExplorer tickets={tickets} />
        </Reveal>
      )}
    </div>
  );
}
