import { cn } from "@/lib/utils/cn";

/**
 * DevStackCoverage — a single horizontal segmented bar of a developer's
 * language mix (byte-weighted across every repo they touched), with legend
 * chips underneath. One of the few sanctioned accent-hue moments: each segment
 * takes a rung of the fixed accent cycle, tail languages collapse into a
 * neutral "Other" segment so the bar never turns into confetti.
 */
export type StackSlice = { language: string; loc: number };

const SEGMENT_HUES = [
  "var(--color-iris)",
  "var(--color-accent-blue)",
  "var(--color-accent-green)",
  "var(--color-accent-yellow)",
  "var(--color-accent-red)",
  "var(--color-iris-bright)",
];
const OTHER_HUE = "var(--color-mute)";
const MAX_SEGMENTS = 6;

export function DevStackCoverage({
  languages,
  className,
}: {
  languages: StackSlice[];
  className?: string;
}) {
  const positive = languages.filter((l) => l.loc > 0);
  const total = positive.reduce((n, l) => n + l.loc, 0);

  if (positive.length === 0 || total === 0) {
    return (
      <p className={cn("text-[13px] leading-[1.6] text-mute", className)}>
        No language telemetry recorded for this developer yet.
      </p>
    );
  }

  const head = positive.slice(0, MAX_SEGMENTS);
  const tail = positive.slice(MAX_SEGMENTS);
  const segments = head.map((l, i) => ({
    language: l.language,
    loc: l.loc,
    hue: SEGMENT_HUES[i % SEGMENT_HUES.length]!,
  }));
  if (tail.length > 0) {
    segments.push({
      language: "Other",
      loc: tail.reduce((n, l) => n + l.loc, 0),
      hue: OTHER_HUE,
    });
  }

  const pct = (loc: number) => (loc / total) * 100;
  const pctLabel = (loc: number) => {
    const p = pct(loc);
    return p >= 10 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
  };

  return (
    <div className={className}>
      <div
        className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-surface-elevated"
        role="img"
        aria-label={segments
          .map((s) => `${s.language} ${pctLabel(s.loc)}`)
          .join(", ")}
      >
        {segments.map((s) => (
          <div
            key={s.language}
            className="h-full"
            style={{ flexGrow: s.loc, flexBasis: 0, backgroundColor: s.hue }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {segments.map((s) => (
          <span
            key={s.language}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[11px] text-body"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.hue }}
              aria-hidden
            />
            {s.language}
            <span className="text-mute tabular-nums">{pctLabel(s.loc)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
