import { STATUS_LABELS, TOOL_LABELS, type TicketStatus, type Tool } from "@/lib/ticketing/types";

/**
 * ticket-table — shared cell renderers + filter predicates for the two
 * ticket DataTable explorers (requester list and admin console), so status
 * grouping, tool chips and age formatting never drift between the two.
 */

/** Statuses that mean "sitting with an approver". */
export const REVIEW_STATUSES: TicketStatus[] = ["peeyush_review", "kamal_review"];

/** Compact relative age: "just now", "5m", "3h", "4d", "2mo", "1y". */
export function formatAge(from: string | Date, now: number = Date.now()): string {
  const t = typeof from === "string" ? new Date(from).getTime() : from.getTime();
  const minutes = Math.floor(Math.max(0, now - t) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** Grouped facet match: "review" spans both approver stages. */
export function matchesStatusFacet(status: TicketStatus, facet: string): boolean {
  if (!facet) return true;
  if (facet === "review") return REVIEW_STATUSES.includes(status);
  return status === facet;
}

/** Lower-cased haystack for the FilterBar search needle. */
export function ticketSearchHaystack(ticket: {
  id: string;
  team: string;
  tools: string[];
  status: TicketStatus;
  requesterName?: string;
  requesterEmail?: string;
}): string {
  return [
    ticket.id,
    ticket.team,
    ticket.requesterName,
    ticket.requesterEmail,
    STATUS_LABELS[ticket.status],
    ...ticket.tools.map((t) => TOOL_LABELS[t as Tool] ?? t),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Hairline tool chips — quiet, monochrome, wrap-friendly. */
export function ToolChips({ tools }: { tools: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tools.map((tool) => (
        <span
          key={tool}
          className="inline-flex items-center rounded-full border border-hairline bg-surface-elevated px-2 py-0.5 text-[12px] leading-[1.5] text-body"
        >
          {TOOL_LABELS[tool as Tool] ?? tool}
        </span>
      ))}
    </div>
  );
}
