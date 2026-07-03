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
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader
          title="Developer Tools Access"
          iconTone="iris"
          icon={<Ticket size={22} strokeWidth={1.75} className="text-iris" />}
          description="Raise or track a request for AWS, Azure, Jenkins, Grafana or Superset access. Managed by DevOps & IT."
          actions={
            <>
              {isAdmin && (
                <Link
                  href="/tickets/admin"
                  className="text-label text-iris transition-colors duration-150 ease-smooth hover:text-iris-bright"
                >
                  Admin console
                </Link>
              )}
              <Link href="/tickets/new" className={buttonClass("primary", "md")}>
                <PlusSquare size={15} strokeWidth={1.75} />
                New request
              </Link>
            </>
          }
        />
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
