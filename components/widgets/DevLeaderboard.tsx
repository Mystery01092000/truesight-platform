import { RollupNumber } from "@/components/ui/RollupNumber";
import { cn } from "@/lib/utils/cn";

/**
 * DevLeaderboard — a ranked developer table with a per-rank contribution bar.
 * The bar fills with the brightness ladder (brightest = #1) so the podium reads
 * at a glance without saturated accent.
 */
export type LeaderEntry = {
  name: string;
  github: string;
  commits: number;
  loc: number;
};

export type DevLeaderboardProps = {
  contributors: LeaderEntry[];
  className?: string;
};

const BAR_FILL = ["bg-on-dark", "bg-charcoal", "bg-body", "bg-mute", "bg-ash"];
const fillFor = (i: number) => BAR_FILL[Math.min(i, BAR_FILL.length - 1)];

function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/[\s._-]/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function DevLeaderboard({ contributors, className }: DevLeaderboardProps) {
  const rows = [...contributors]
    .sort((a, b) => b.commits - a.commits || b.loc - a.loc)
    .slice(0, 12);
  const max = Math.max(1, ...rows.map((c) => c.commits));

  return (
    <ol className={cn("flex flex-col gap-1", className)}>
      {rows.map((c, i) => (
        <li
          key={c.github || c.name}
          className="flex items-center gap-3 rounded-md px-1.5 py-1.5"
        >
          <span className="w-5 shrink-0 text-right font-mono text-[12px] text-ash tabular-nums">
            {i + 1}
          </span>
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full border border-hairline bg-surface-card font-mono text-[11px] text-body"
            aria-hidden
          >
            {initials(c.name || c.github)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink">
                {c.name}
                <span className="ml-1.5 font-mono text-[12px] text-mute">{c.github}</span>
              </span>
              <span className="shrink-0 font-mono text-[13px] text-ink tabular-nums">
                <RollupNumber value={c.loc} /> <span className="text-[11px] text-mute">loc</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className={cn("h-full rounded-full", fillFor(i))}
                style={{ width: `${Math.max(4, (c.commits / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="px-1.5 py-2 text-[13px] text-mute">No contributor activity yet.</li>
      )}
    </ol>
  );
}
