"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CheckCircle2, Hourglass, Ticket } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { StatTile } from "@/components/ui/StatTile";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import {
  formatAge,
  matchesStatusFacet,
  ticketSearchHaystack,
  ToolChips,
  REVIEW_STATUSES,
} from "@/components/ticketing/ticket-table";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticketing/types";

export type MyTicket = {
  id: string;
  requesterName: string;
  team: string;
  tools: string[];
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
};

const FACET_OPTIONS: { value: string; label: string; statuses: TicketStatus[] }[] = [
  { value: "pending", label: "Pending", statuses: ["pending"] },
  { value: "review", label: "In review", statuses: REVIEW_STATUSES },
  { value: "approved", label: "Approved", statuses: ["approved"] },
  { value: "done", label: "Done", statuses: ["done"] },
  { value: "declined", label: "Declined", statuses: ["declined"] },
];

/**
 * TicketsExplorer — the requester's tracker: KPI StatTiles, a FilterBar
 * (status facet + search) and a paginated DataTable of their requests.
 * Fully client-side over the serialized rows the server page hands it.
 */
export function TicketsExplorer({ tickets }: { tickets: MyTicket[] }) {
  const [search, setSearch] = useState("");
  const [statusFacet, setStatusFacet] = useState("");

  // ---- KPIs ----------------------------------------------------------------
  const now = new Date();
  const openCount = tickets.filter(
    (t) => t.status !== "done" && t.status !== "declined",
  ).length;
  const awaitingCount = tickets.filter(
    (t) => t.status === "pending" || REVIEW_STATUSES.includes(t.status),
  ).length;
  const doneThisMonth = tickets.filter((t) => {
    if (t.status !== "done") return false;
    const d = new Date(t.updatedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // ---- Filtering (search + facet both applied here so counts stay honest) --
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!matchesStatusFacet(t.status, statusFacet)) return false;
      if (needle && !ticketSearchHaystack(t).includes(needle)) return false;
      return true;
    });
  }, [tickets, search, statusFacet]);

  const facets: FilterFacet[] = [
    {
      key: "status",
      label: "Status",
      options: FACET_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        count: tickets.filter((t) => o.statuses.includes(t.status)).length,
      })),
    },
  ];

  const columns = useMemo<ColumnDef<MyTicket>[]>(
    () => [
      {
        id: "tools",
        header: "Tools",
        accessorFn: (t) => t.tools.join(" "),
        cell: ({ row }) => <ToolChips tools={row.original.tools} />,
        enableSorting: false,
      },
      {
        id: "requester",
        header: "Requester",
        accessorKey: "requesterName",
        cell: ({ row }) => (
          <span className="text-on-dark">{row.original.requesterName}</span>
        ),
      },
      { id: "team", header: "Team", accessorKey: "team" },
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
            View
            <ArrowRight size={13} strokeWidth={1.75} />
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Open requests" value={openCount} icon={<Ticket />} />
        <StatTile label="Awaiting approval" value={awaitingCount} icon={<Hourglass />} />
        <StatTile label="Done this month" value={doneThisMonth} icon={<CheckCircle2 />} />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by tool, team or status…"
        facets={facets}
        values={{ status: statusFacet }}
        onFacetChange={(_, value) => setStatusFacet(value)}
        resultCount={filtered.length}
        resultNoun="request"
        onClearAll={() => {
          setSearch("");
          setStatusFacet("");
        }}
      />

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No requests match your filters."
      />
    </div>
  );
}
