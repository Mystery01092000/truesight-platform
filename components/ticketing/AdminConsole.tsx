"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CheckCircle2, Hourglass, ThumbsUp, XCircle } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { StatTile } from "@/components/ui/StatTile";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import {
  formatAge,
  ticketSearchHaystack,
  ToolChips,
  REVIEW_STATUSES,
} from "@/components/ticketing/ticket-table";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export type AdminTicket = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  team: string;
  tools: string[];
  status: TicketStatus;
  createdAt: string;
};

const STATS: { label: string; statuses: TicketStatus[]; icon: React.ReactNode }[] = [
  { label: "In review", statuses: REVIEW_STATUSES, icon: <Hourglass /> },
  { label: "Approved", statuses: ["approved"], icon: <ThumbsUp /> },
  { label: "Completed", statuses: ["done"], icon: <CheckCircle2 /> },
  { label: "Declined", statuses: ["declined"], icon: <XCircle /> },
];

const FACET_STATUSES: TicketStatus[] = [
  "pending",
  "peeyush_review",
  "kamal_review",
  "approved",
  "done",
  "declined",
];

/**
 * AdminConsole — the org-wide queue: KPI StatTiles, a FilterBar with a
 * per-stage status facet + search, and a paginated DataTable dense enough
 * to sweep an approval backlog in one sitting.
 */
export function AdminConsole({ tickets }: { tickets: AdminTicket[] }) {
  const [search, setSearch] = useState("");
  const [statusFacet, setStatusFacet] = useState("");

  const stats = STATS.map((s) => ({
    ...s,
    count: tickets.filter((t) => s.statuses.includes(t.status)).length,
  }));

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFacet && t.status !== statusFacet) return false;
      if (needle && !ticketSearchHaystack(t).includes(needle)) return false;
      return true;
    });
  }, [tickets, search, statusFacet]);

  const facets: FilterFacet[] = [
    {
      key: "status",
      label: "Status",
      options: FACET_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
        count: tickets.filter((t) => t.status === status).length,
      })),
    },
  ];

  const columns = useMemo<ColumnDef<AdminTicket>[]>(
    () => [
      {
        id: "requester",
        header: "Requester",
        accessorFn: (t) => `${t.requesterName} ${t.requesterEmail}`,
        cell: ({ row }) => (
          <div>
            <div className="text-[14px] leading-[1.5] text-on-dark">
              {row.original.requesterName}
            </div>
            <div className="text-[12px] leading-[1.5] text-ash">
              {row.original.requesterEmail}
            </div>
          </div>
        ),
      },
      { id: "team", header: "Team", accessorKey: "team" },
      {
        id: "tools",
        header: "Tools",
        accessorFn: (t) => t.tools.join(" "),
        cell: ({ row }) => <ToolChips tools={row.original.tools} />,
        enableSorting: false,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (t) => STATUS_LABELS[t.status],
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        id: "age",
        header: "Age",
        accessorFn: (t) => new Date(t.createdAt).getTime(),
        cell: ({ row }) => (
          <span
            className="font-mono text-label tabular-nums text-mute"
            title={new Date(row.original.createdAt).toLocaleString()}
          >
            {formatAge(row.original.createdAt)}
          </span>
        ),
        sortDescFirst: true,
      },
      {
        id: "open",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/tickets/${row.original.id}`}
            className="inline-flex items-center gap-1 text-label text-iris transition-colors duration-150 ease-smooth hover:text-iris-bright"
          >
            Open
            <ArrowRight size={13} strokeWidth={1.75} />
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.count} icon={s.icon} />
        ))}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search requester, team, tool…"
        facets={facets}
        values={{ status: statusFacet }}
        onFacetChange={(_, value) => setStatusFacet(value)}
        resultCount={filtered.length}
        resultNoun="ticket"
        onClearAll={() => {
          setSearch("");
          setStatusFacet("");
        }}
      />

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No tickets match this filter."
      />
    </div>
  );
}
