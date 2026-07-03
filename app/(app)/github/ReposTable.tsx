"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/DataTable";
import { TextInput } from "@/components/ui/TextInput";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatNumber } from "@/lib/utils/format";

/**
 * ReposTable — the org repository inventory as a sortable, paginated
 * DataTable. Receives plain serializable rows from the server page (never
 * fetches); search is a controlled global filter across all columns.
 */

export type RepoRow = {
  urn: string;
  name: string;
  language: string | null;
  stars: number;
  totalContributions: number;
  contributorCount: number;
  pushedAt: string | null;
  htmlUrl: string;
  archived: boolean;
  visibility: string;
};

export function ReposTable({ repos }: { repos: RepoRow[] }) {
  const [filter, setFilter] = useState("");

  const columns = useMemo<ColumnDef<RepoRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Repository",
        cell: ({ row }) => (
          <a
            href={row.original.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 font-mono text-label text-ink transition-colors hover:text-iris-bright"
          >
            <span className="truncate">{row.original.name}</span>
            <ExternalLink
              size={11}
              strokeWidth={1.75}
              className="shrink-0 text-stone transition-colors group-hover:text-iris-bright"
            />
          </a>
        ),
      },
      {
        accessorKey: "language",
        header: "Language",
        cell: ({ getValue }) => (
          <span className="font-mono text-[12px] text-mute">
            {(getValue<string | null>()) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "stars",
        header: "Stars",
        cell: ({ getValue }) => (
          <span className="font-mono text-label tabular-nums text-body">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "totalContributions",
        header: "Commits",
        cell: ({ getValue }) => (
          <span className="font-mono text-label tabular-nums text-body">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "contributorCount",
        header: "Contributors",
        cell: ({ getValue }) => (
          <span className="font-mono text-label tabular-nums text-body">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "pushedAt",
        header: "Last push",
        cell: ({ getValue }) => (
          <span className="font-mono text-[12px] tabular-nums text-mute">
            {formatDate(getValue<string | null>() ?? "")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            {row.original.visibility === "private" && <Badge>Private</Badge>}
            {row.original.archived && <Badge>Archived</Badge>}
            {row.original.visibility !== "private" && !row.original.archived && (
              <span className="text-[12px] text-mute">Active</span>
            )}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-3 max-w-xs">
        <TextInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter repositories..."
          icon={<Search size={16} strokeWidth={1.75} />}
          aria-label="Filter repositories"
        />
      </div>
      <DataTable
        columns={columns}
        data={repos}
        globalFilter={filter}
        pageSize={10}
        emptyMessage="No repositories match this filter."
      />
    </div>
  );
}
