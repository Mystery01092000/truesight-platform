"use client";

import { useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Pagination } from "@/components/ui/Pagination";

/**
 * DataTable — the one primary tabular surface in Argus (drill-down only).
 * Headless @tanstack/react-table wrapped in the design system: a hairline-edged
 * Surface, a quiet surface-elevated header row, and hairline row separators —
 * never zebra fills or shadows. Columns opt into sorting via the table config.
 *
 * Pagination is on by default (footer appears only once rows exceed pageSize,
 * so small tables render exactly as before). `globalFilter` is a controlled
 * needle matched across all columns. For very large sets, `virtualized`
 * swaps pagination for a fixed-row-height virtual scroller.
 */
export function DataTable<TData>({
  columns,
  data,
  className,
  emptyMessage = "No rows.",
  pageSize = 25,
  globalFilter,
  virtualized = false,
  rowHeight = 41,
  maxHeight = 480,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  className?: string;
  emptyMessage?: string;
  /** Rows per page (default 25). Ignored when `virtualized`. */
  pageSize?: number;
  /** Controlled search needle, matched case-insensitively across all columns. */
  globalFilter?: string;
  /** Render all rows in a virtual scroller instead of paginating. */
  virtualized?: boolean;
  /** Fixed row height in px for the virtualizer (default 41). */
  rowHeight?: number;
  /** Scroll container max height in px when `virtualized` (default 480). */
  maxHeight?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: globalFilter ?? "" },
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(virtualized ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: activePageSize } = table.getState().pagination;
  const showFooter = !virtualized && total > pageSize;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    enabled: virtualized,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const padTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const padBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const renderRow = (row: (typeof rows)[number], style?: React.CSSProperties) => (
    <tr
      key={row.id}
      style={style}
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
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-surface",
        className,
      )}
    >
      <div
        ref={scrollRef}
        className={cn("overflow-x-auto", virtualized && "overflow-y-auto")}
        style={virtualized ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse text-left">
          <thead className={cn(virtualized && "sticky top-0 z-10")}>
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
            ) : virtualized ? (
              <>
                {padTop > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length} style={{ height: padTop, padding: 0 }} />
                  </tr>
                )}
                {virtualRows.map((vr) => renderRow(rows[vr.index], { height: rowHeight }))}
                {padBottom > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length} style={{ height: padBottom, padding: 0 }} />
                  </tr>
                )}
              </>
            ) : (
              rows.map((row) => renderRow(row))
            )}
          </tbody>
        </table>
      </div>
      {showFooter && (
        <Pagination
          page={pageIndex}
          pageCount={table.getPageCount()}
          pageSize={activePageSize}
          total={total}
          onPageChange={table.setPageIndex}
          onPageSizeChange={table.setPageSize}
          className="border-t border-hairline px-3.5 py-2"
        />
      )}
    </div>
  );
}
