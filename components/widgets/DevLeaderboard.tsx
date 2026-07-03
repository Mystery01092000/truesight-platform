"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";

import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

/**
 * DevLeaderboard — the Developer Portal directory: a FilterBar (login search +
 * team facet with counts) over a paginated DataTable ranked by net LOC. Every
 * row links through to the /developers/<login> profile. The activity sparkline
 * column appears only when a weekly series is actually available — never a
 * decorative fake.
 */
export type DeveloperRow = {
  login: string;
  team: string | null;
  totalLoc: number;
  additions: number;
  deletions: number;
  commits: number;
  topLanguages: { language: string; loc: number }[];
  repoCount: number;
  /** Optional weekly contribution series (renders a sparkline when ≥2 points). */
  trend?: number[];
};

type RankedRow = DeveloperRow & { rank: number };

const UNASSIGNED = "__unassigned";

function initials(login: string): string {
  const parts = login.replace(/^@/, "").split(/[\s._-]/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** GitHub avatar via the stable `<login>.png` pattern — no next/image remote
 *  loader config required. Falls back to a monogram if the image 404s. */
function DevAvatar({ login, size = 28 }: { login: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full border border-hairline bg-surface-card font-mono text-[10px] uppercase text-body"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials(login)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${encodeURIComponent(login)}.png?size=64`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full border border-hairline bg-surface-card"
      aria-hidden
    />
  );
}

export function DevLeaderboard({
  developers,
  className,
}: {
  /** Pre-sorted by net LOC descending — rank is positional. */
  developers: DeveloperRow[];
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");

  const ranked = useMemo<RankedRow[]>(
    () => developers.map((d, i) => ({ ...d, rank: i + 1 })),
    [developers],
  );

  const teamFacet = useMemo<FilterFacet>(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const d of developers) {
      if (d.team) counts.set(d.team, (counts.get(d.team) ?? 0) + 1);
      else unassigned += 1;
    }
    const options = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        label: <span className="font-mono">{value}</span>,
        count,
      }));
    if (unassigned > 0) {
      options.push({ value: UNASSIGNED, label: <span>Unassigned</span>, count: unassigned });
    }
    return { key: "team", label: "Team", options };
  }, [developers]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ranked.filter((d) => {
      if (team === UNASSIGNED && d.team) return false;
      if (team && team !== UNASSIGNED && d.team !== team) return false;
      if (!needle) return true;
      return (
        d.login.toLowerCase().includes(needle) ||
        (d.team ?? "").toLowerCase().includes(needle)
      );
    });
  }, [ranked, search, team]);

  const hasTrend = useMemo(
    () => developers.some((d) => (d.trend?.length ?? 0) >= 2),
    [developers],
  );

  const columns = useMemo<ColumnDef<RankedRow>[]>(() => {
    const cols: ColumnDef<RankedRow>[] = [
      {
        accessorKey: "rank",
        header: "#",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-ash tabular-nums">
            {row.original.rank}
          </span>
        ),
      },
      {
        accessorKey: "login",
        header: "Developer",
        cell: ({ row }) => (
          <Link
            href={`/developers/${encodeURIComponent(row.original.login)}`}
            className="group/dev inline-flex items-center gap-2.5"
          >
            <DevAvatar login={row.original.login} />
            <span className="font-mono text-label text-ink underline-offset-4 transition-colors duration-150 ease-smooth group-hover/dev:underline">
              {row.original.login}
            </span>
          </Link>
        ),
      },
      {
        id: "team",
        accessorFn: (d) => d.team ?? "",
        header: "Team",
        cell: ({ row }) =>
          row.original.team ? (
            <Badge className="font-mono">{row.original.team}</Badge>
          ) : (
            <span className="text-[12px] text-ash">—</span>
          ),
      },
      {
        accessorKey: "totalLoc",
        header: "Net LOC",
        cell: ({ row }) => (
          <span className="font-mono text-label text-ink tabular-nums">
            {formatNumber(row.original.totalLoc)}
          </span>
        ),
      },
      {
        accessorKey: "commits",
        header: "Commits",
        cell: ({ row }) => (
          <span className="font-mono text-label text-mute tabular-nums">
            {formatNumber(row.original.commits)}
          </span>
        ),
      },
      {
        accessorKey: "repoCount",
        header: "Repos",
        cell: ({ row }) => (
          <span className="font-mono text-label text-mute tabular-nums">
            {row.original.repoCount > 0 ? formatNumber(row.original.repoCount) : "—"}
          </span>
        ),
      },
      {
        id: "languages",
        header: "Top languages",
        enableSorting: false,
        cell: ({ row }) => {
          const langs = row.original.topLanguages.slice(0, 3);
          if (langs.length === 0) return <span className="text-[12px] text-ash">—</span>;
          return (
            <span className="flex flex-wrap items-center gap-1">
              {langs.map((l) => (
                <span
                  key={l.language}
                  className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-micro text-body"
                >
                  {l.language}
                </span>
              ))}
            </span>
          );
        },
      },
    ];

    if (hasTrend) {
      cols.push({
        id: "trend",
        header: "Activity",
        enableSorting: false,
        cell: ({ row }) =>
          (row.original.trend?.length ?? 0) >= 2 ? (
            <Sparkline data={row.original.trend!} width={88} height={22} />
          ) : (
            <span className="text-[12px] text-ash">—</span>
          ),
      });
    }

    cols.push({
      id: "open",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/developers/${encodeURIComponent(row.original.login)}`}
          aria-label={`Open ${row.original.login}'s profile`}
          className="inline-flex text-ash transition-colors duration-150 ease-smooth hover:text-on-dark"
        >
          <ArrowUpRight size={15} strokeWidth={1.75} />
        </Link>
      ),
    });

    return cols;
  }, [hasTrend]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search developers…"
        facets={teamFacet.options.length > 0 ? [teamFacet] : []}
        values={{ team }}
        onFacetChange={(_key, value) => setTeam(value)}
        resultCount={rows.length}
        resultNoun="developer"
        onClearAll={() => {
          setSearch("");
          setTeam("");
        }}
      />
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No developers match this filter."
      />
    </div>
  );
}
