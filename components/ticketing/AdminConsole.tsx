"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { PillTabs } from "@/components/ui/PillTabs";
import { TicketStatusBadge } from "@/components/ticketing/TicketStatusBadge";
import type { TicketStatus } from "@/lib/ticketing/types";

export type AdminTicket = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  team: string;
  tools: string[];
  status: TicketStatus;
  createdAt: string;
};

type FilterStatus = "all" | TicketStatus;

const FILTER_ITEMS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "peeyush_review", label: "Peeyush" },
  { value: "kamal_review", label: "Kamal" },
  { value: "approved", label: "Approved" },
  { value: "done", label: "Done" },
  { value: "declined", label: "Declined" },
];

const STATS: { label: string; statuses: TicketStatus[] }[] = [
  { label: "In review", statuses: ["peeyush_review", "kamal_review"] },
  { label: "Approved", statuses: ["approved"] },
  { label: "Completed", statuses: ["done"] },
  { label: "Declined", statuses: ["declined"] },
];

export function AdminConsole({ tickets }: { tickets: AdminTicket[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [, startTransition] = useTransition();

  const stats = STATS.map((s) => ({
    ...s,
    count: tickets.filter((t) => s.statuses.includes(t.status)).length,
  }));

  const filtered =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-hairline bg-surface p-4"
          >
            <div className="text-[12px] text-mute">{s.label}</div>
            <div className="mt-1 font-display text-[28px] font-medium leading-none tabular-nums text-ink">
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between gap-4">
        <PillTabs
          value={filter}
          onChange={(v) => {
            setFilter(v as FilterStatus);
            startTransition(() => router.refresh());
          }}
          items={FILTER_ITEMS}
          aria-label="Filter tickets by status"
        />
        <span className="text-[12px] text-mute">{filtered.length} tickets</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-surface-elevated">
                <th className="px-3.5 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Requester</th>
                <th className="px-3.5 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Team</th>
                <th className="px-3.5 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Tools</th>
                <th className="px-3.5 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Status</th>
                <th className="px-3.5 py-2.5 text-[13px] font-medium tracking-[0.2px] text-mute">Raised</th>
                <th className="px-3.5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-12 text-center text-[14px] text-mute">
                    No tickets match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-b border-hairline transition-colors last:border-0 hover:bg-surface-elevated",
                    )}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="text-[14px] leading-[1.6] text-on-dark">{t.requesterName}</div>
                      <div className="text-[12px] text-ash">{t.requesterEmail}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-[14px] text-body">{t.team}</td>
                    <td className="px-3.5 py-2.5 text-[14px] text-body">{t.tools.join(" · ")}</td>
                    <td className="px-3.5 py-2.5">
                      <TicketStatusBadge status={t.status} />
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px] text-mute">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <a
                        href={`/tickets/${t.id}`}
                        className="text-[13px] text-iris hover:text-iris-bright"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
