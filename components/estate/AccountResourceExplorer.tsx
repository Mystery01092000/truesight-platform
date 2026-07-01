"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  formatLastSeen,
  kindLabel,
  statusBadge,
  type EstateResource,
} from "@/components/estate/types";

const ALL = "all";

/**
 * AccountResourceExplorer — the account drill-down. Region / service PillTabs
 * narrow a @tanstack/react-table DataTable (the one place tables lead), with
 * columns Name / Kind / Service / Region / Status / Last seen sourced straight
 * from the real `resources` rows.
 */
export function AccountResourceExplorer({ resources }: { resources: EstateResource[] }) {
  const [region, setRegion] = useState<string>(ALL);
  const [service, setService] = useState<string>(ALL);

  const regions = useMemo(
    () => [...new Set(resources.map((r) => r.region))].sort(),
    [resources],
  );
  const services = useMemo(
    () => [...new Set(resources.map((r) => r.service))].sort(),
    [resources],
  );

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

  const columns = useMemo<ColumnDef<EstateResource>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium text-ink">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: ({ row }) => kindLabel(row.original.kind),
      },
      { accessorKey: "service", header: "Service" },
      {
        accessorKey: "region",
        header: "Region",
        cell: ({ row }) => (
          <span className="tabular-nums text-mute">{row.original.region}</span>
        ),
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
          <span className="tabular-nums text-mute">
            {formatLastSeen(row.original.lastSeen)}
          </span>
        ),
      },
    ],
    [],
  );

  const regionItems: PillTabItem[] = [
    { value: ALL, label: "All regions" },
    ...regions.map((r) => ({ value: r, label: r })),
  ];
  const serviceItems: PillTabItem[] = [
    { value: ALL, label: "All services" },
    ...services.map((s) => ({ value: s, label: s })),
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
          <span className="shrink-0 text-[12px] tabular-nums text-mute">
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

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No resources match this filter."
      />
    </div>
  );
}
