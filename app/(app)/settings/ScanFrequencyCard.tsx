"use client";

import { useState } from "react";
import { Timer } from "lucide-react";

import { PillTabs } from "@/components/ui/PillTabs";

/**
 * ScanFrequencyCard — segmented control over the scheduled-scan interval,
 * wired to the existing /api/settings/scan-frequency route (GET current /
 * PUT update). Optimistic select with revert on failure.
 */
const PRESET_HOURS = [1, 3, 6, 12, 24];

export function ScanFrequencyCard({ initialHours }: { initialHours: number }) {
  const [hours, setHours] = useState(initialHours);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  // Keep a non-preset persisted value selectable instead of hiding it.
  const options = PRESET_HOURS.includes(initialHours)
    ? PRESET_HOURS
    : [...PRESET_HOURS, initialHours].sort((a, b) => a - b);

  const select = async (value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next) || next === hours || busy) return;
    const previous = hours;
    setHours(next);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/scan-frequency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanFrequencyHours: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      setStatus({ kind: "saved", text: `Saved — scans run every ${next}h.` });
    } catch (err) {
      setHours(previous);
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Scan frequency
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-mute">
            How often the scheduled security scan sweeps the estate.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[13px] leading-[1.5] text-body tabular-nums"
          aria-live="polite"
        >
          <Timer size={14} strokeWidth={1.75} className="text-mute" aria-hidden />
          every {hours}h
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PillTabs
          aria-label="Scan frequency"
          value={String(hours)}
          onChange={select}
          items={options.map((h) => ({ value: String(h), label: `${h}h` }))}
        />
        <span
          aria-live="polite"
          className={
            status?.kind === "error"
              ? "text-[11px] leading-[1.4] text-critical"
              : "text-[11px] leading-[1.4] text-positive"
          }
        >
          {status?.text}
        </span>
      </div>
    </div>
  );
}
