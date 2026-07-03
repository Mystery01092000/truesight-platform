import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { accessTickets } from "@/db/schema";
import { Reveal } from "@/components/ui/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader
          title="Ticket admin"
          iconTone="iris"
          icon={<ShieldCheck size={22} strokeWidth={1.75} className="text-iris" />}
          description="Every developer-tools access request across the org. Approve, advance or complete."
        />
      </Reveal>

      <Reveal delay={0.06}>
        <AdminConsole tickets={tickets} />
      </Reveal>
    </div>
  );
}
