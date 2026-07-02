import type { Metadata } from "next";

import { NewTicketFlow } from "@/components/ticketing/NewTicketFlow";

export const metadata: Metadata = { title: "New Access Request" };

/**
 * /tickets/new — the request form is a client-side GuidedFlow journey
 * (Identity → Tools & access → Purpose & timeline → Review & submit).
 * All form state and the POST /api/tickets contract live in NewTicketFlow.
 */
export default function NewTicketPage() {
  return <NewTicketFlow />;
}
