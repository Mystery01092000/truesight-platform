"use client";

import { cn } from "@/lib/utils/cn";
import { WatcherScene } from "@/components/brand/WatcherScene";
import { useLandingStats } from "@/components/marketing/useLandingStats";

/* ────────────────────────────────────────────────────────────────────────── *
 * EstateAtlas — the landing hero centrepiece. The cinematic WatcherScene (the
 * Truesight aperture over a live cross-cloud constellation) framed as a console,
 * with a quiet live ribbon along the base. The ribbon shows *presence*, not
 * counts: each provider dot lights when the synced estate confirms resources in
 * that cloud — so the "Live" claim stays honest without leading with ambiguous
 * numbers. Loading shows skeleton chips; a failed fetch degrades to a neutral
 * multi-cloud label with the live claim dropped. Never a fabricated signal.
 * ────────────────────────────────────────────────────────────────────────── */

const PROVIDERS = [
  { key: "aws" as const, label: "AWS", dot: "bg-accent-yellow" },
  { key: "azure" as const, label: "Azure", dot: "bg-accent-blue" },
  { key: "github" as const, label: "GitHub", dot: "bg-on-dark" },
];

export function EstateAtlas() {
  const { data, isError, isLoading } = useLandingStats();

  const live = !!data;

  return (
    <div className="w-full max-w-[520px]">
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl border border-hairline bg-canvas">
        {/* The cinematic field */}
        <WatcherScene fit="meet" />

        {/* Top chrome — an honest live label, no figures */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
          <span className="inline-flex items-center gap-2 text-[12px] font-medium tracking-[0.3px] text-on-dark-mute">
            <span className="relative grid place-items-center">
              <span className="absolute size-3 rounded-full border border-iris/50 animate-pulse-ring" />
              <span className="size-1.5 rounded-full bg-iris" />
            </span>
            {live ? "Live estate" : "Estate"}
          </span>
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full border border-hairline-strong" />
            ))}
          </div>
        </div>

        {/* Base ribbon — provider presence */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-hairline/60 bg-canvas/40 px-5 py-3.5 backdrop-blur-sm">
          <span className="text-[11px] uppercase tracking-[1.2px] text-stone">
            {isError ? "Multi-cloud" : "Watching"}
          </span>
          <div className="flex items-center gap-3.5">
            {isLoading ? (
              PROVIDERS.map((p) => <span key={p.key} className="skeleton h-3 w-14" />)
            ) : (
              PROVIDERS.map((p) => {
                const present = !!data && data.providers[p.key] > 0;
                return (
                  <span
                    key={p.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[12px] tracking-[0.2px] transition-colors duration-500",
                      present ? "text-body" : "text-stone",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full transition-opacity duration-500",
                        p.dot,
                        present ? "opacity-100" : "opacity-30",
                      )}
                    />
                    {p.label}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
