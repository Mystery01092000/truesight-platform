"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { SearchX } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";
import { Reveal } from "@/components/ui/Reveal";
import { AppIconTile } from "@/components/ui/AppIconTile";
import {
  azureServiceLabel,
  formatLastSeen,
  isDataPlatformService,
  kindLabel,
  sortEnvironments,
  statusBadge,
  STATUS_RAIL,
  type EstateResource,
} from "@/components/estate/types";
import type { ResourceKind } from "@/lib/taxonomy";

/** Above this many rows the DataTable swaps pagination for virtualization. */
const VIRTUALIZE_AT = 200;
/** Facet pills rendered per facet before the tail is folded away. */
const FACET_CAP = 14;
/** Tag chips shown inline per row before collapsing into "+N". */
const TAG_PREVIEW = 2;

type ViewMode = "all" | "service";

type FacetKey = "service" | "environment" | "region" | "status";
type FacetValues = Record<FacetKey, string>;
const NO_FACETS: FacetValues = { service: "", environment: "", region: "", status: "" };

export type ResourceExplorerProps = {
  resources: EstateResource[];
  provider: "aws" | "azure";
  /**
   * Renders the grouping column (AWS account / Azure resource group) linking
   * into `${hrefBase}/[id]`. Omit on drill-down pages already scoped to one group.
   */
  groupColumn?: { header: string; hrefBase: string };
  /** Namespace for persisted view/facet state, e.g. `truesight:aws:estate`. */
  storageKey: string;
  className?: string;
};

/**
 * ResourceExplorer — the shared multi-cloud discovery console. One FilterBar
 * (search + service/environment/region/status facets with live counts) feeds
 * either the full DataTable ("All resources", paginated, virtualized past 200
 * rows) or the grouped service-card view ("By service") — service cards drill
 * back into the table pre-filtered to that service.
 */
export function ResourceExplorer({
  resources,
  provider,
  groupColumn,
  storageKey,
  className,
}: ResourceExplorerProps) {
  const [view, setView] = usePersistedState<ViewMode>(`${storageKey}:view`, "all");
  const [facets, setFacets] = usePersistedState<FacetValues>(`${storageKey}:facets`, NO_FACETS);
  const [search, setSearch] = useState("");

  const serviceLabel = (service: string): string =>
    provider === "azure" ? azureServiceLabel(service) : service;

  const needle = search.trim().toLowerCase();

  /** Match one row against search + every facet except `skip` (for facet counts). */
  const matches = useMemo(() => {
    return (r: EstateResource, skip?: FacetKey): boolean => {
      if (needle) {
        const hay = [
          r.name,
          r.service,
          serviceLabel(r.service),
          r.nativeType ?? "",
          r.region,
          r.account,
          r.environment ?? "",
          ...Object.entries(r.tags ?? {}).map(([k, v]) => `${k}=${v}`),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (skip !== "service" && facets.service && r.service !== facets.service) return false;
      if (skip !== "environment" && facets.environment && (r.environment ?? "") !== facets.environment)
        return false;
      if (skip !== "region" && facets.region && r.region !== facets.region) return false;
      if (skip !== "status" && facets.status && r.status !== facets.status) return false;
      return true;
    };
    // serviceLabel is stable per provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, facets, provider]);

  const rows = useMemo(() => resources.filter((r) => matches(r)), [resources, matches]);

  // The by-service grid ignores the service facet (cards ARE the drill-in), so
  // its result count must too — otherwise the FilterBar count reads wrong.
  const serviceViewCount = useMemo(
    () => resources.reduce((n, r) => n + (matches(r, "service") ? 1 : 0), 0),
    [resources, matches],
  );

  /** Count facet options over rows filtered by everything except that facet. */
  const facetDefs = useMemo<FilterFacet[]>(() => {
    const count = (skip: FacetKey, pick: (r: EstateResource) => string | null | undefined) => {
      const tally = new Map<string, number>();
      for (const r of resources) {
        if (!matches(r, skip)) continue;
        const v = pick(r);
        if (!v) continue;
        tally.set(v, (tally.get(v) ?? 0) + 1);
      }
      return tally;
    };

    const toOptions = (
      tally: Map<string, number>,
      active: string,
      label: (v: string) => React.ReactNode,
      cap = FACET_CAP,
    ) => {
      const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const top = sorted.slice(0, cap);
      // The active value must stay visible even when it falls out of the top slice.
      if (active && !top.some(([v]) => v === active)) {
        const held = sorted.find(([v]) => v === active);
        if (held) top.push(held);
      }
      return top.map(([value, n]) => ({ value, label: label(value), count: n }));
    };

    const mono = (v: string) => <span className="font-mono">{v}</span>;

    const defs: FilterFacet[] = [
      {
        key: "service",
        label: "Service",
        options: toOptions(count("service", (r) => r.service), facets.service, (v) => (
          <span className="font-mono">{serviceLabel(v)}</span>
        )),
      },
      {
        key: "environment",
        label: "Environment",
        options: toOptions(
          count("environment", (r) => r.environment ?? null),
          facets.environment,
          mono,
        ),
      },
      {
        key: "region",
        label: "Region",
        options: toOptions(count("region", (r) => r.region), facets.region, mono),
      },
      {
        key: "status",
        label: "Status",
        options: toOptions(
          count("status", (r) => r.status),
          facets.status,
          (v) => statusBadge(v as EstateResource["status"]).label,
        ),
      },
    ];
    // Facets with a single (or no) option carry no signal — drop them.
    return defs.filter((d) => d.options.length > 1 || (d.options.length === 1 && facets[d.key as FacetKey]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, matches, facets, provider]);

  const setFacet = (key: string, value: string) =>
    setFacets((prev) => ({ ...prev, [key]: value }));
  const clearAll = () => {
    setSearch("");
    setFacets(NO_FACETS);
  };

  const columns = useMemo<ColumnDef<EstateResource>[]>(() => {
    const detailHref = `/topology?provider=${provider}`;
    const cols: ColumnDef<EstateResource>[] = [
      {
        accessorKey: "name",
        header: "Resource",
        cell: ({ row }) => {
          const r = row.original;
          const b = statusBadge(r.status);
          return (
            <Link
              href={detailHref}
              title={`${r.name} — ${b.label.toLowerCase()} · open in topology`}
              className="group/row inline-flex min-w-0 max-w-[320px] items-center gap-2.5"
            >
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", STATUS_RAIL[r.status])}
              />
              <span className="sr-only">{b.label}:</span>
              <span className="truncate font-mono text-label leading-[1.6] text-ink transition-colors duration-150 ease-smooth group-hover/row:text-on-dark">
                {r.name}
              </span>
            </Link>
          );
        },
      },
      {
        accessorKey: "service",
        header: "Service",
        cell: ({ row }) => {
          const r = row.original;
          const native = r.nativeType && r.nativeType !== r.service ? r.nativeType : null;
          return (
            <span
              className="block max-w-[280px] truncate font-mono text-[12.5px] leading-[1.6]"
              title={native ? `${serviceLabel(r.service)} · ${native}` : serviceLabel(r.service)}
            >
              <span className="text-body">{serviceLabel(r.service)}</span>
              {native && <span className="text-mute"> · {native}</span>}
            </span>
          );
        },
      },
    ];

    if (groupColumn) {
      cols.push({
        accessorKey: "account",
        header: groupColumn.header,
        cell: ({ row }) => (
          <Link
            href={`${groupColumn.hrefBase}/${encodeURIComponent(row.original.account)}`}
            className="font-mono text-[12.5px] leading-[1.6] text-body tabular-nums transition-colors duration-150 ease-smooth hover:text-on-dark"
          >
            {row.original.account}
          </Link>
        ),
      });
    }

    cols.push(
      {
        accessorKey: "region",
        header: "Region",
        cell: ({ row }) => (
          <span className="font-mono text-[12.5px] leading-[1.6] text-mute">
            {row.original.region}
          </span>
        ),
      },
      {
        accessorKey: "environment",
        header: "Env",
        cell: ({ row }) =>
          row.original.environment ? (
            <Badge className="font-mono text-micro">{row.original.environment}</Badge>
          ) : (
            <span className="text-ash">—</span>
          ),
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => <TagChips tags={row.original.tags} />,
      },
      {
        accessorKey: "lastSeen",
        header: "Last seen",
        cell: ({ row }) => (
          <span className="font-mono text-[12.5px] leading-[1.6] text-mute tabular-nums">
            {formatLastSeen(row.original.lastSeen)}
          </span>
        ),
      },
    );
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, groupColumn?.header, groupColumn?.hrefBase]);

  const viewItems: PillTabItem[] = [
    { value: "all", label: "All resources" },
    { value: "service", label: "By service" },
  ];

  return (
    <div className={className}>
      <div className="mb-4">
        <PillTabs
          aria-label="Explorer view"
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          items={viewItems}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search resources…"
        facets={view === "all" ? facetDefs : facetDefs.filter((f) => f.key !== "service")}
        values={facets}
        onFacetChange={setFacet}
        resultCount={view === "all" ? rows.length : serviceViewCount}
        resultNoun="resource"
        onClearAll={clearAll}
        className="mb-5"
      />

      {view === "all" ? (
        rows.length === 0 ? (
          <ExplorerEmpty onClear={clearAll} />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            virtualized={rows.length > VIRTUALIZE_AT}
            rowHeight={44}
            emptyMessage="No resources match this filter."
          />
        )
      ) : (
        <ServiceCardGrid
          provider={provider}
          resources={resources}
          matches={matches}
          onDrill={(service) => {
            setFacets((prev) => ({ ...prev, service }));
            setView("all");
          }}
          onClear={clearAll}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag chips — truncated inline chips, full set in the title tooltip          */
/* -------------------------------------------------------------------------- */

function TagChips({ tags }: { tags?: Record<string, string> }) {
  const entries = Object.entries(tags ?? {});
  if (entries.length === 0) return <span className="text-ash">—</span>;

  const shown = entries.slice(0, TAG_PREVIEW);
  const rest = entries.length - shown.length;
  const full = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  return (
    <span className="flex items-center gap-1" title={full}>
      {shown.map(([k, v]) => (
        <Badge key={k} className="max-w-[150px] font-mono text-micro">
          <span className="truncate">
            {k}={v}
          </span>
        </Badge>
      ))}
      {rest > 0 && <Badge className="font-mono text-micro tabular-nums">+{rest}</Badge>}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* By-service view — service cards that drill into the filtered table         */
/* -------------------------------------------------------------------------- */

type ServiceCardData = {
  service: string;
  kind: ResourceKind;
  count: number;
  regions: string[];
  environments: string[];
};

function groupByServiceKey(rows: EstateResource[]): ServiceCardData[] {
  const buckets = new Map<string, EstateResource[]>();
  for (const r of rows) {
    const list = buckets.get(r.service);
    if (list) list.push(r);
    else buckets.set(r.service, [r]);
  }

  const cards: ServiceCardData[] = [];
  for (const [service, list] of buckets) {
    const tally = new Map<ResourceKind, number>();
    for (const r of list) tally.set(r.kind, (tally.get(r.kind) ?? 0) + 1);
    let kind: ResourceKind = "unknown";
    let bestN = -1;
    for (const [k, n] of tally) {
      if (n > bestN) {
        kind = k;
        bestN = n;
      }
    }
    cards.push({
      service,
      kind,
      count: list.length,
      regions: [...new Set(list.map((r) => r.region))].sort(),
      environments: sortEnvironments(
        list.map((r) => r.environment).filter((e): e is string => Boolean(e)),
      ),
    });
  }
  return cards.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
}

function ServiceCardGrid({
  provider,
  resources,
  matches,
  onDrill,
  onClear,
}: {
  provider: "aws" | "azure";
  resources: EstateResource[];
  matches: (r: EstateResource, skip?: FacetKey) => boolean;
  onDrill: (service: string) => void;
  onClear: () => void;
}) {
  // The service facet is what cards drill INTO — ignore it when grouping.
  const cards = useMemo(
    () => groupByServiceKey(resources.filter((r) => matches(r, "service"))),
    [resources, matches],
  );

  if (cards.length === 0) return <ExplorerEmpty onClear={onClear} />;

  // Azure's legacy data estate (SQL servers/databases, managed instances,
  // Databricks, Data Factory) reads as one "Data platform" section.
  const dataPlatform = provider === "azure" ? cards.filter((c) => isDataPlatformService(c.service)) : [];
  const rest = provider === "azure" ? cards.filter((c) => !isDataPlatformService(c.service)) : cards;

  const sections: { title: string | null; cards: ServiceCardData[] }[] =
    dataPlatform.length > 0
      ? [
          { title: "Data platform", cards: dataPlatform },
          { title: "Services", cards: rest },
        ]
      : [{ title: null, cards: rest }];

  return (
    <div className="flex flex-col gap-6">
      {sections.map(
        (section) =>
          section.cards.length > 0 && (
            <section key={section.title ?? "all"}>
              {section.title && (
                <h3 className="mb-3 text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
                  {section.title}
                </h3>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.cards.map((card, i) => (
                  <Reveal key={card.service} delay={Math.min(i, 8) * 0.04}>
                    <ServiceCard provider={provider} card={card} onDrill={onDrill} />
                  </Reveal>
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}

function ServiceCard({
  provider,
  card,
  onDrill,
}: {
  provider: "aws" | "azure";
  card: ServiceCardData;
  onDrill: (service: string) => void;
}) {
  const { service, kind, count, regions, environments } = card;
  const label = provider === "azure" ? azureServiceLabel(service) : service;
  const regionLabel = regions.length === 1 ? regions[0] : `${regions.length} regions`;
  const envs = environments.slice(0, 3);
  const envRest = environments.length - envs.length;

  return (
    <button
      type="button"
      onClick={() => onDrill(service)}
      aria-label={`View the ${count} ${label} ${count === 1 ? "resource" : "resources"}`}
      className={cn(
        "w-full rounded-lg border border-hairline bg-surface p-4 text-left",
        "transition-colors duration-150 ease-smooth hover:border-hairline-strong hover:bg-surface-elevated",
      )}
    >
      <div className="flex items-start gap-3">
        <AppIconTile kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[14px] font-medium leading-[1.4] text-ink" title={label}>
            {label}
          </div>
          <div className="mt-0.5 truncate text-[12px] leading-[1.5] text-mute">
            {kindLabel(kind)} · <span className="font-mono">{regionLabel}</span>
          </div>
        </div>
        <Badge className="shrink-0 tabular-nums">{count}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline-soft pt-2.5">
        {envs.length > 0 ? (
          <>
            {envs.map((env) => (
              <Badge key={env} className="font-mono text-micro">
                {env}
              </Badge>
            ))}
            {envRest > 0 && (
              <Badge className="font-mono text-micro tabular-nums">+{envRest}</Badge>
            )}
          </>
        ) : (
          <span className="text-micro leading-[1.4] text-ash">no env tags</span>
        )}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Filtered-to-nothing state                                                  */
/* -------------------------------------------------------------------------- */

function ExplorerEmpty({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<SearchX />}
      title="No resources match this filter"
      description="Truesight found nothing in the estate for this combination. Loosen the search or clear the facets."
      action={
        <Button variant="install" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}
