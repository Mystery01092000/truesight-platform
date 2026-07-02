import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { accessTickets } from "@/db/schema";
import { Reveal } from "@/components/ui/Reveal";
import { AdminConsole, type AdminTicket } from "@/components/ticketing/AdminConsole";
import type { TicketStatus } from "@/lib/ticketing/types";

export const metadata: Metadata = { title: "Ticket Admin" };
export const dynamic = "force-dynamic";

export default async function TicketAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "tickets:admin")) redirect("/tickets");

  const rows = await db
    .select()
    .from(accessTickets)
    .orderBy(desc(accessTickets.createdAt))
    .limit(200);

  const tickets: AdminTicket[] = rows.map((r) => ({
    id: r.id,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    team: r.team,
    tools: r.tools as string[],
    status: r.status as TicketStatus,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-6 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <ShieldCheck size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Ticket admin
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Every developer-tools access request across the org. Approve, advance or complete.
            </p>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.06}>
        <AdminConsole tickets={tickets} />
      </Reveal>
    </div>
  );
}
