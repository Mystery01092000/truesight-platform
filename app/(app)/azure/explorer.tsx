"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "@/lib/utils/cn";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { Surface } from "@/components/ui/Surface";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";
import { Reveal } from "@/components/ui/Reveal";
import { DataTable } from "@/components/ui/DataTable";
import {
  formatLastSeen,
  kindLabel,
  statusBadge,
  STATUS_RAIL,
} from "@/components/estate/types";
import type { AzureResource, AzureServiceGroup } from "./data";

const ALL = "all";
const PREVIEW = 4;

/* -------------------------------------------------------------------------- */
/* Main estate explorer — resource-group / service filters + service tiles    */
/* -------------------------------------------------------------------------- */

/**
 * AzureEstateExplorer — the client shell for the Azure explorer (parity with the
 * AWS EstateFilters). Holds the resource-group / service selection (persisted
 * cross-session), renders the PillTabs, and paints the filtered responsive grid
 * of service tiles with a staggered Reveal that re-runs on filter change.
 */
export function AzureEstateExplorer({
  resourceGroups,
  services,
}: {
  resourceGroups: string[];
  services: AzureServiceGroup[];
}) {
  const [rg, setRg] = usePersistedState<string>("argus.azure.rg", ALL);
  const [service, setService] = usePersistedState<string>("argus.azure.service", ALL);

  const byRg = useMemo(
    () => (rg === ALL ? services : services.filter((g) => g.resourceGroup === rg)),
    [services, rg],
  );

  const serviceNames = useMemo(
    () => [...new Set(byRg.map((g) => g.service))].sort(),
    [byRg],
  );
  const activeService = serviceNames.includes(service) ? service : ALL;

  const visible = useMemo(
    () => (activeService === ALL ? byRg : byRg.filter((g) => g.service === activeService)),
    [byRg, activeService],
  );

  const rgItems: PillTabItem[] = [
    { value: ALL, label: "All resource groups" },
    ...resourceGroups.map((r) => ({ value: r, label: <span className="font-mono">{r}</span> })),
  ];
  const serviceItems: PillTabItem[] = [
    { value: ALL, label: "All services" },
    ...serviceNames.map((s) => ({ value: s, label: <span className="font-mono">{s}</span> })),
  ];

  const shown = visible.reduce((n, g) => n + g.count, 0);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 border-b border-hairline pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto">
            <PillTabs aria-label="Filter by resource group" value={rg} onChange={setRg} items={rgItems} />
          </div>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-mute">
            {visible.length} {visible.length === 1 ? "service" : "services"} · {shown}{" "}
            {shown === 1 ? "resource" : "resources"}
          </span>
        </div>
        {serviceItems.length > 1 && (
          <div className="-mb-1 flex flex-wrap gap-1 overflow-x-auto">
            <PillTabs
              aria-label="Filter by service"
              value={activeService}
              onChange={setService}
              items={serviceItems}
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-[14px] leading-[1.6] text-mute">
          No resources match this filter.
        </p>
      ) : (
        <div
          key={`${rg}:${activeService}`}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map((group, i) => (
            <Reveal key={`${group.resourceGroup}:${group.service}`} delay={Math.min(i, 8) * 0.05}>
              <AzureServiceCard group={group} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/** One Azure service within a resource group — a Surface tile (parity: ServiceGroup). */
function AzureServiceCard({ group }: { group: AzureServiceGroup }) {
  const { service, kind, regions, count, resources, resourceGroup } = group;
  const preview = resources.slice(0, PREVIEW);
  const remaining = count - preview.length;
  const regionLabel = regions.length === 1 ? regions[0] : `${regions.length} regions`;

  return (
    <Surface level={1} radius="lg" className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <AppIconTile kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[14px] font-medium leading-[1.4] text-ink">
            {service}
          </div>
          <div className="mt-0.5 truncate text-[12px] leading-[1.5] text-mute">
            {kindLabel(kind)} · <span className="font-mono">{regionLabel}</span>
          </div>
        </div>
        <Badge className="shrink-0 tabular-nums">{count}</Badge>
      </div>

      <div className="mt-3 -mx-1.5 border-t border-hairline pt-2">
        <div className="flex flex-col gap-0.5">
          {preview.map((r) => (
            <AzureResourceRow key={r.urn} resource={r} />
          ))}
        </div>
        {remaining > 0 && (
          <Link
            href={`/azure/${encodeURIComponent(resourceGroup)}`}
            className="mt-1 inline-flex items-center px-2.5 py-1 text-[12px] leading-[1.5] text-mute transition-colors hover:text-body"
          >
            +{remaining} more {remaining === 1 ? "resource" : "resources"}
          </Link>
        )}
      </div>
    </Surface>
  );
}

/** One Azure resource as a compact, clickable row (parity: ResourceCard). */
function AzureResourceRow({ resource }: { resource: AzureResource }) {
  const { name, service, region, kind, status, resourceGroup } = resource;
  const badge = statusBadge(status);

  return (
    <Link
      href={`/azure/${encodeURIComponent(resourceGroup)}`}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-md px-2.5 py-2 pl-3.5",
        "transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-full", STATUS_RAIL[status])}
      />
      <AppIconTile kind={kind} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] leading-[1.6] text-body transition-colors group-hover:text-ink">
          {name}
        </div>
        <div className="truncate text-[12px] leading-[1.5] text-mute">
          <span className="font-mono">{service}</span> · <span className="font-mono">{region}</span>
        </div>
      </div>
      <StatusBadge status={badge.status} label={badge.label} className="shrink-0" />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Resource-group drill-down table                                            */
/* -------------------------------------------------------------------------- */

/**
 * AzureResourceTable — the resource-group drill-down. Region / service PillTabs
 * narrow a @tanstack/react-table DataTable sourced straight from the real
 * `resources` rows. All machine data (name, ARM type, region) reads in font-mono.
 */
export function AzureResourceTable({ resources }: { resources: AzureResource[] }) {
  const [region, setRegion] = useState<string>(ALL);
  const [service, setService] = useState<string>(ALL);

  const regions = useMemo(() => [...new Set(resources.map((r) => r.region))].sort(), [resources]);
  const services = useMemo(() => [...new Set(resources.map((r) => r.service))].sort(), [resources]);

  const activeRegion = regions.includes(region) ? region : ALL;
  const activeService = services.includes(service) ? service : ALL;

  const rows = useMemo(
    () =>
      resources.filter(
        (r) =>
          (activeRegion === ALL || r.region === activeRegion) &&
          (activeService === ALL || r.service === activeService),
      ),
    [resources, activeRegion, activeService],
  );

  const columns = useMemo<ColumnDef<AzureResource>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-mono text-ink">{row.original.name}</span>,
      },
      {
        accessorKey: "nativeType",
        header: "Type",
        cell: ({ row }) => <span className="font-mono text-mute">{row.original.nativeType}</span>,
      },
      { accessorKey: "kind", header: "Kind", cell: ({ row }) => kindLabel(row.original.kind) },
      {
        accessorKey: "service",
        header: "Service",
        cell: ({ row }) => <span className="font-mono">{row.original.service}</span>,
      },
      {
        accessorKey: "region",
        header: "Region",
        cell: ({ row }) => <span className="font-mono text-mute">{row.original.region}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const b = statusBadge(row.original.status);
          return <StatusBadge status={b.status} label={b.label} />;
        },
      },
      {
        accessorKey: "lastSeen",
        header: "Last seen",
        cell: ({ row }) => (
          <span className="font-mono text-mute">{formatLastSeen(row.original.lastSeen)}</span>
        ),
      },
    ],
    [],
  );

  const regionItems: PillTabItem[] = [
    { value: ALL, label: "All regions" },
    ...regions.map((r) => ({ value: r, label: <span className="font-mono">{r}</span> })),
  ];
  const serviceItems: PillTabItem[] = [
    { value: ALL, label: "All services" },
    ...services.map((s) => ({ value: s, label: <span className="font-mono">{s}</span> })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="overflow-x-auto">
            <PillTabs
              aria-label="Filter by region"
              value={activeRegion}
              onChange={setRegion}
              items={regionItems}
            />
          </div>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-mute">
            {rows.length} of {resources.length}
          </span>
        </div>
        {services.length > 1 && (
          <div className="overflow-x-auto">
            <PillTabs
              aria-label="Filter by service"
              value={activeService}
              onChange={setService}
              items={serviceItems}
            />
          </div>
        )}
      </div>

      <DataTable columns={columns} data={rows} emptyMessage="No resources match this filter." />
    </div>
  );
}
