"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Pagination — the quiet table footer control. A mono "x–y of z" range label at
 * the left, page-size select + prev/next hairline buttons at the right. Fully
 * controlled: the table owns the state, this only renders and reports it.
 */
export type PaginationProps = {
  /** Zero-based page index. */
  page: number;
  pageCount: number;
  pageSize: number;
  /** Total row count across all pages (post-filter). */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

const NAV_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-sm border border-hairline text-mute transition-colors duration-150 ease-smooth hover:bg-surface-elevated hover:text-on-dark disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <span className="font-mono text-[12px] tabular-nums text-mute" aria-live="polite">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-[12px] leading-[1.5] text-ash">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-sm border border-hairline bg-surface-elevated px-1.5 font-mono text-[12px] text-body transition-colors focus:border-hairline-strong focus:outline-none"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className={NAV_BUTTON}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-1 font-mono text-[12px] tabular-nums text-mute">
            {Math.min(page + 1, Math.max(pageCount, 1))}/{Math.max(pageCount, 1)}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
            className={NAV_BUTTON}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
