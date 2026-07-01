"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * DataTable — the one primary tabular surface in Argus (drill-down only).
 * Headless @tanstack/react-table wrapped in the design system: a hairline-edged
 * Surface, a quiet surface-elevated header row, and hairline row separators —
 * never zebra fills or shadows. Columns opt into sorting via the table config.
 */
export function DataTable<TData>({
  columns,
  data,
  className,
  emptyMessage = "No rows.",
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  className?: string;
  emptyMessage?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-surface",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-hairline bg-surface-elevated">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-3.5 py-2.5 text-[14px] font-medium leading-[1.6] tracking-[0.2px] text-mute"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-on-dark"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp size={13} className="text-on-dark" />
                          ) : sorted === "desc" ? (
                            <ArrowDown size={13} className="text-on-dark" />
                          ) : (
                            <ChevronsUpDown size={13} className="text-stone" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3.5 py-12 text-center text-[14px] leading-[1.6] text-mute"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-hairline transition-colors last:border-0 hover:bg-surface-elevated"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3.5 py-2.5 align-middle text-[14px] leading-[1.6] text-body"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
