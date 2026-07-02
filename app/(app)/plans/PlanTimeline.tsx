"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Server, FlaskConical, Wrench, FileCode2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { cn } from "@/lib/utils/cn";

/**
 * PlanTimeline — the chat-style execution feed for /plans. Days arrive
 * newest-first from the server with every display string pre-formatted
 * (no client-side date math → no hydration drift). The only client state
 * is the per-entry state-tree disclosure (250ms height reveal).
 */
export type PlanEntry = {
  id: string;
  displayName: string;
  env: string | null;
  service: string | null;
  sizeLabel: string;
  timeLabel: string;
  key: string;
};

export type PlanDay = { label: string; entries: PlanEntry[] };

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Env → rail glyph. Monochrome per the accent discipline; the env Badge carries the name. */
function envGlyph(env: string | null): React.ReactNode {
  const e = (env ?? "").toLowerCase();
  if (e === "prod" || e === "production") return <Server strokeWidth={1.75} />;
  if (e === "staging" || e === "stage" || e === "uat") return <FlaskConical strokeWidth={1.75} />;
  if (e === "dev" || e === "development" || e === "sandbox") return <Wrench strokeWidth={1.75} />;
  return <FileCode2 strokeWidth={1.75} />;
}

function EntryBody({ entry }: { entry: PlanEntry }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const segments = entry.key.split("/").filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] leading-[1.4] tracking-[0.06em] text-mute tabular-nums">
          {entry.sizeLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-[11px] font-medium leading-[1.4] tracking-[0.06em] text-mute transition-colors duration-150 hover:text-on-dark"
        >
          <ChevronRight
            size={12}
            className={cn("transition-transform duration-150", open && "rotate-90")}
            aria-hidden
          />
          State path
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-md border border-hairline bg-surface-elevated p-3">
              {/* Key path segments as a breadcrumb of the state tree. */}
              <div className="flex flex-wrap items-center gap-1">
                {segments.map((seg, i) => (
                  <span key={`${seg}-${i}`} className="inline-flex items-center gap-1">
                    <span className="rounded-xs bg-surface-card px-1.5 py-0.5 font-mono text-[11px] leading-[1.4] text-body">
                      {seg}
                    </span>
                    {i < segments.length - 1 && (
                      <span className="text-[11px] text-stone" aria-hidden>
                        /
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <p className="mt-2 break-all font-mono text-[11px] leading-[1.5] text-ash">
                {entry.key}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PlanTimeline({ days }: { days: PlanDay[] }) {
  return (
    <div className="space-y-8">
      {days.map((day) => {
        const items: TimelineItem[] = day.entries.map((entry) => ({
          id: entry.id,
          marker: envGlyph(entry.env),
          title: (
            <>
              <span className="font-medium text-ink">{entry.displayName}</span>
              {entry.env && <Badge>{entry.env}</Badge>}
              {entry.service && <Badge>{entry.service}</Badge>}
            </>
          ),
          timestamp: entry.timeLabel,
          body: <EntryBody entry={entry} />,
        }));

        return (
          <section key={day.label} aria-label={day.label}>
            {/* Date divider — a micro label on a hairline rule. */}
            <div className="mb-5 flex items-center gap-3">
              <h2 className="shrink-0 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.06em] text-mute">
                {day.label}
              </h2>
              <span className="h-px flex-1 bg-hairline" aria-hidden />
            </div>
            <Timeline variant="chat" items={items} />
          </section>
        );
      })}
    </div>
  );
}
