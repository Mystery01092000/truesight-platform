"use client";

import { formatNumber, formatRelative } from "@/lib/utils/format";
import { useLandingStats } from "@/components/marketing/useLandingStats";

/*
 * StatsStrip — live governance totals under the hero, in the instrument voice
 * (mono, tabular). Every figure comes straight from /api/landing-stats; a
 * missing or zero value renders an em-dash, never an invented number.
 */

type StatItem = { label: string; value: string | null };

export function StatsStrip() {
  const { data, isLoading } = useLandingStats();

  const clouds = data
    ? Number(data.providers.aws > 0) + Number(data.providers.azure > 0)
    : 0;

  const items: StatItem[] = [
    {
      label: "Resources under watch",
      value: data && data.resources > 0 ? formatNumber(data.resources) : null,
    },
    {
      label: "Accounts · subscriptions",
      value: data && data.accounts > 0 ? formatNumber(data.accounts) : null,
    },
    {
      label: "Clouds connected",
      value: clouds > 0 ? formatNumber(clouds) : null,
    },
    {
      label: "Snapshot updated",
      value: data ? formatRelative(data.updatedAt) : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-y-8 py-8 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-1.5 md:border-l md:border-hairline md:pl-8 md:first:border-l-0 md:first:pl-0"
        >
          <span className="font-mono text-[22px] leading-[1.2] tabular-nums text-ink">
            {isLoading ? (
              <span className="skeleton inline-block h-6 w-16 align-middle" />
            ) : (
              (item.value ?? "—")
            )}
          </span>
          <span className="text-micro uppercase text-ash">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
