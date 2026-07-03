"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/DataTable";
import { FilterBar, type FilterFacet } from "@/components/ui/FilterBar";
import { ProviderChip, PROVIDER_LABEL } from "@/components/ui/ProviderChip";
import { formatCurrency } from "@/lib/utils/format";
import type { CloudProvider } from "@/lib/taxonomy";
import type { CostFacets, CostLineItem } from "@/app/(app)/cost/data";

/**
 * CostLineItemsTable — the drill-down grid under the FinOps console. Server-computed
 * facets (provider / account / service, with counts) drive a controlled FilterBar;
 * facet selection and the search needle both filter the delivered rows client-side
 * before they reach DataTable, so the FilterBar result count always matches the
 * visible rows. Amounts in mono tabular-nums, right-aligned.
 */

const EMPTY_VALUES: Record<string, string> = { provider: "", account: "", service: "" };

function fmtAmount(n: number): string {
  return formatCurrency(n, { decimals: 2 });
}

export type CostLineItemsTableProps = {
  rows: CostLineItem[];
  facets: CostFacets;
};

export function CostLineItemsTable({ rows, facets }: CostLineItemsTableProps) {
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(EMPTY_VALUES);

  const filterFacets: FilterFacet[] = useMemo(
    () => [
      {
        key: "provider",
        label: "Provider",
        options: facets.provider.map((o) => ({
          value: o.value,
          label: PROVIDER_LABEL[o.value as CloudProvider] ?? o.value,
          count: o.count,
        })),
      },
      {
        key: "account",
        label: "Account",
        options: facets.account.map((o) => ({ value: o.value, label: o.value, count: o.count })),
      },
      {
        key: "service",
        label: "Service",
        options: facets.service.map((o) => ({ value: o.value, label: o.value, count: o.count })),
      },
    ],
    [facets],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (values.provider && r.provider !== values.provider) return false;
      if (values.account && r.account !== values.account) return false;
      if (values.service && r.service !== values.service) return false;
      if (!needle) return true;
      return (
        r.day.toLowerCase().includes(needle) ||
        r.provider.toLowerCase().includes(needle) ||
        r.account.toLowerCase().includes(needle) ||
        r.service.toLowerCase().includes(needle) ||
        String(r.amount).includes(needle)
      );
    });
  }, [rows, values, search]);

  const columns = useMemo<ColumnDef<CostLineItem>[]>(
    () => [
      {
        accessorKey: "day",
        header: "Day",
        cell: ({ getValue }) => (
          <span className="font-mono text-label tabular-nums text-mute">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider",
        cell: ({ getValue }) => <ProviderChip provider={getValue<CloudProvider>()} />,
      },
      {
        accessorKey: "account",
        header: "Account",
        cell: ({ getValue }) => (
          <span className="block max-w-[200px] truncate font-mono text-label text-body">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "service",
        header: "Service",
        cell: ({ getValue }) => (
          <span className="block max-w-[280px] truncate text-body">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">Amount</span>,
        cell: ({ getValue }) => (
          <span className="block text-right font-mono text-[14px] tabular-nums text-ink">
            {fmtAmount(getValue<number>())}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search line items…"
        facets={filterFacets}
        values={values}
        onFacetChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
        resultCount={filtered.length}
        resultNoun="line item"
        onClearAll={() => {
          setSearch("");
          setValues(EMPTY_VALUES);
        }}
      />
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No line items match the current filters."
        className="mt-4"
      />
    </div>
  );
}
