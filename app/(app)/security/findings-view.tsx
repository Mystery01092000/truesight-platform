"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, RotateCcw, ShieldAlert } from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";
import {
  VulnFindingDetail,
  type VulnFinding,
} from "@/components/widgets/VulnFindingDetail";
import { SEVERITIES } from "@/lib/taxonomy";

/**
 * SecurityFindingsView — the live vulnerability scanner console. A client
 * island that reads /api/vulnerabilities (severity/source/status filters run
 * server-side; the search needle filters the fetched slice client-side via
 * DataTable's globalFilter), lists findings in the standard DataTable, and
 * opens the right Drawer with the full finding detail on row click.
 */

type VulnResponse = {
  findings: VulnFinding[];
  total: number;
  facets: { severity: Record<string, number>; source: Record<string, number> };
};

const STATUSES = ["open", "fixed", "dismissed"] as const;

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeAgo(iso: string): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Last URN segment (`provider:account:region:service:nativeId` → nativeId). */
function urnTail(urn: string | null): string {
  if (!urn) return "";
  const parts = urn.split(":");
  return parts[parts.length - 1] || urn;
}

async function fetchVulnerabilities(filters: {
  severity: string;
  source: string;
  status: string;
}): Promise<VulnResponse> {
  const params = new URLSearchParams({ limit: "500" });
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  const res = await fetch(`/api/vulnerabilities?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`vulnerabilities ${res.status}`);
  return (await res.json()) as VulnResponse;
}

export function SecurityFindingsView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [facetValues, setFacetValues] = useState<Record<string, string>>({
    severity: "",
    source: "",
    status: "",
  });
  const [selected, setSelected] = useState<VulnFinding | null>(null);
  // Union of every source ever seen, so source pills survive a filtered slice
  // (the API computes facet counts against the active filters).
  const [knownSources, setKnownSources] = useState<string[]>([]);
  const [scan, setScan] = useState<"idle" | "running" | "forbidden" | "error" | "partial">(
    "idle",
  );
  const [scanIssues, setScanIssues] = useState<string[]>([]);

  const { severity, source, status } = facetValues;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vulnerabilities", severity, source, status],
    queryFn: () => fetchVulnerabilities({ severity, source, status }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (!data) return;
    setKnownSources((prev) => {
      const next = new Set(prev);
      for (const key of Object.keys(data.facets.source)) next.add(key);
      return next.size === prev.length ? prev : [...next].sort();
    });
  }, [data]);

  const facets: FilterFacet[] = useMemo(() => {
    const sevCounts = data?.facets.severity ?? {};
    const srcCounts = data?.facets.source ?? {};
    return [
      {
        key: "severity",
        label: "Severity",
        options: SEVERITIES.map((s) => ({
          value: s,
          label: capitalize(s),
          count: sevCounts[s] ?? 0,
        })),
      },
      {
        key: "source",
        label: "Source",
        options: knownSources.map((s) => ({
          value: s,
          label: s,
          count: srcCounts[s] ?? 0,
        })),
      },
      {
        key: "status",
        label: "Status",
        options: STATUSES.map((s) => ({ value: s, label: capitalize(s) })),
      },
    ];
  }, [data, knownSources]);

  const columns = useMemo<ColumnDef<VulnFinding>[]>(
    () => [
      {
        id: "severity",
        accessorFn: (f) => f.severity ?? "info",
        header: "Severity",
        sortingFn: (a, b) =>
          (SEVERITY_WEIGHT[a.original.severity ?? "info"] ?? 0) -
          (SEVERITY_WEIGHT[b.original.severity ?? "info"] ?? 0),
        cell: ({ row }) => <StatusBadge status={row.original.severity ?? "info"} />,
      },
      {
        id: "title",
        accessorFn: (f) => f.title ?? "Untitled finding",
        header: "Finding",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelected(row.original)}
            title={row.original.title ?? undefined}
            className="block max-w-[340px] truncate text-left font-medium text-ink transition-colors duration-150 ease-smooth hover:text-iris"
          >
            {row.original.title ?? "Untitled finding"}
          </button>
        ),
      },
      {
        id: "package",
        accessorFn: (f) => [f.packageName, f.cve].filter(Boolean).join(" "),
        header: "Package / CVE",
        cell: ({ row }) => {
          const { packageName, cve } = row.original;
          if (!packageName && !cve) return <span className="text-ash">—</span>;
          return (
            <span className="block max-w-[200px] font-mono text-[12px] leading-[1.5]">
              {packageName ? <span className="block truncate text-body">{packageName}</span> : null}
              {cve ? <span className="block truncate text-mute">{cve}</span> : null}
            </span>
          );
        },
      },
      {
        id: "resource",
        accessorFn: (f) => urnTail(f.urn),
        header: "Resource",
        cell: ({ getValue }) => {
          const tail = getValue<string>();
          return tail ? (
            <span className="block max-w-[180px] truncate font-mono text-[12px] text-mute">
              {tail}
            </span>
          ) : (
            <span className="text-ash">—</span>
          );
        },
      },
      {
        id: "source",
        accessorKey: "source",
        header: "Source",
        cell: ({ getValue }) => <Badge className="font-mono">{getValue<string>()}</Badge>,
      },
      {
        id: "lastSeen",
        accessorFn: (f) => f.lastSeen,
        header: "Last seen",
        sortingFn: (a, b) =>
          new Date(a.original.lastSeen).getTime() - new Date(b.original.lastSeen).getTime(),
        cell: ({ row }) => (
          <span
            className="whitespace-nowrap font-mono text-[12px] text-mute tabular-nums"
            title={new Date(row.original.lastSeen).toLocaleString()}
          >
            {timeAgo(row.original.lastSeen)}
          </span>
        ),
      },
      {
        id: "open",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelected(row.original)}
            aria-label={`View finding: ${row.original.title ?? "untitled"}`}
            className="grid size-6 place-items-center rounded-sm text-mute transition-colors duration-150 ease-smooth hover:bg-surface-elevated hover:text-on-dark"
          >
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ),
      },
    ],
    [],
  );

  async function runScan() {
    setScan("running");
    try {
      const res = await fetch("/api/security", { method: "POST" });
      if (res.status === 403) {
        setScan("forbidden");
        return;
      }
      if (!res.ok) throw new Error(`scan ${res.status}`);
      const body = (await res.json().catch(() => null)) as {
        summary?: { ok?: boolean; errors?: { scope?: string; message?: string }[] };
      } | null;
      const issues = (body?.summary?.errors ?? []).flatMap((e) =>
        typeof e?.message === "string" ? [[e.scope, e.message].filter(Boolean).join(": ")] : [],
      );
      setScanIssues(issues);
      setScan(body?.summary?.ok === false ? "partial" : "idle");
      await refetch();
      router.refresh();
    } catch {
      setScan("error");
    }
  }

  const isFiltered = Boolean(severity || source || status || search);

  if (isLoading) {
    return (
      <Surface level={1} radius="lg" className="p-5" aria-busy>
        <div className="flex items-center justify-between gap-3">
          <Skeleton.Block className="h-8 w-64" />
          <Skeleton.Block className="h-4 w-20" />
        </div>
        <div className="mt-5 space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton.Row key={i} />
          ))}
        </div>
      </Surface>
    );
  }

  if (isError) {
    return (
      <div role="alert">
        <EmptyState
          icon={<ShieldAlert size={24} strokeWidth={1.5} />}
          title="Truesight couldn't load the findings feed"
          description="The vulnerabilities API didn't respond. Retry, or check your session and try again."
          action={
            <Button variant="tertiary" size="sm" onClick={() => refetch()}>
              <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const findings = data?.findings ?? [];
  const total = data?.total ?? 0;

  if (!isFiltered && total === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert size={24} strokeWidth={1.5} />}
        title="Truesight hasn't captured any vulnerabilities yet"
        description="Run a security scan to sweep Inspector2, Security Hub, Defender for Cloud, Dependabot and CodeQL across the estate."
        action={
          <div className="flex flex-col items-center gap-2">
            <Button size="sm" onClick={runScan} disabled={scan === "running"}>
              {scan === "running" ? "Scanning…" : "Run security scan"}
            </Button>
            {scan === "forbidden" ? (
              <p role="alert" className="text-[12px] leading-[1.5] text-mute">
                Your role can&apos;t trigger scans — ask a DevOps admin.
              </p>
            ) : null}
            {scan === "error" ? (
              <p role="alert" className="text-[12px] leading-[1.5] text-critical">
                The scan failed to start. Try again.
              </p>
            ) : null}
            {scan === "partial" ? (
              <p role="alert" className="text-[12px] leading-[1.5] text-accent-yellow">
                Scan finished with errors{scanIssues[0] ? ` — ${scanIssues[0]}` : ""}. Some
                providers may be missing findings.
              </p>
            ) : null}
          </div>
        }
      />
    );
  }

  return (
    <div>
      {scan === "partial" ? (
        <p role="alert" className="mb-3 text-[12px] leading-[1.5] text-accent-yellow">
          Scan finished with errors{scanIssues[0] ? ` — ${scanIssues[0]}` : ""}. Some providers
          may be missing findings.
        </p>
      ) : null}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search findings…"
        facets={facets}
        values={facetValues}
        onFacetChange={(key, value) => setFacetValues((prev) => ({ ...prev, [key]: value }))}
        resultCount={total}
        resultNoun="finding"
        onClearAll={() => {
          setSearch("");
          setFacetValues({ severity: "", source: "", status: "" });
        }}
        className="mb-4"
      />
      <DataTable
        columns={columns}
        data={findings}
        globalFilter={search}
        emptyMessage="No findings match this filter."
      />
      {total > findings.length ? (
        <p className="mt-2 text-[12px] leading-[1.5] text-mute">
          Showing the {findings.length} highest-severity findings of {total}. Narrow by
          severity, source or status to see the rest.
        </p>
      ) : null}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Finding detail"
        width={540}
      >
        {selected ? <VulnFindingDetail finding={selected} /> : null}
      </Drawer>
    </div>
  );
}
