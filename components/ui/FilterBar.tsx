"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TextInput } from "@/components/ui/TextInput";

/**
 * FilterBar — the standard list-header control strip: a search field, facet
 * pill groups (PillTabs vocabulary — the active chip lifts one surface notch),
 * a live result count and a clear-all escape hatch. Fully controlled; the
 * parent owns search text and facet values and does the actual filtering.
 * An empty-string facet value means "no selection" for that facet.
 */
export type FilterFacetOption = {
  value: string;
  label: React.ReactNode;
  count?: number;
};

export type FilterFacet = {
  key: string;
  label: string;
  options: FilterFacetOption[];
};

export type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  facets?: FilterFacet[];
  /** Active option value per facet key ("" = facet inactive). */
  values?: Record<string, string>;
  /** Clicking the active option toggles it back off (value ""). */
  onFacetChange?: (key: string, value: string) => void;
  resultCount?: number;
  /** Singular noun for the result count (default "result"). */
  resultNoun?: string;
  onClearAll?: () => void;
  className?: string;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  facets = [],
  values = {},
  onFacetChange,
  resultCount,
  resultNoun = "result",
  onClearAll,
  className,
}: FilterBarProps) {
  const isFiltered = search !== "" || Object.values(values).some(Boolean);

  return (
    <div className={cn("flex flex-col gap-3 border-b border-hairline pb-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TextInput
          type="search"
          icon={<Search />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 max-w-xs text-[14px]"
        />
        <div className="flex items-center gap-3">
          {resultCount !== undefined && (
            <span className="font-mono text-[12px] tabular-nums text-mute" aria-live="polite">
              {resultCount} {resultCount === 1 ? resultNoun : `${resultNoun}s`}
            </span>
          )}
          {onClearAll && isFiltered && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] leading-[1.5] text-mute transition-colors duration-150 ease-smooth hover:text-on-dark"
            >
              <X size={12} aria-hidden />
              Clear all
            </button>
          )}
        </div>
      </div>

      {facets.map((facet) => {
        const active = values[facet.key] ?? "";
        return (
          <div
            key={facet.key}
            role="group"
            aria-label={facet.label}
            className="flex flex-wrap items-center gap-1"
          >
            <span className="mr-1.5 text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              {facet.label}
            </span>
            {facet.options.map((option) => {
              const selected = option.value === active;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onFacetChange?.(facet.key, selected ? "" : option.value)
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label leading-[1.5] transition-colors duration-150 ease-smooth",
                    selected
                      ? "bg-surface-elevated text-on-dark"
                      : "text-body hover:text-on-dark",
                  )}
                >
                  {option.label}
                  {option.count !== undefined && (
                    <span
                      className={cn(
                        "font-mono text-micro tabular-nums",
                        selected ? "text-mute" : "text-ash",
                      )}
                    >
                      {option.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
