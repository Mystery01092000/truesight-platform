import { Surface } from "@/components/ui/Surface";
import { RollupNumber } from "@/components/ui/RollupNumber";
import { cn } from "@/lib/utils/cn";

/**
 * ContributionChart — a horizontal bar chart of relative developer contribution.
 * Monochrome by design: each bar fills with a rung of the brightness ladder
 * (brighter = higher contributor), never the saturated iris accent.
 */
export type ContributionEntry = {
  name: string;
  commits: number;
  additions: number;
  deletions: number;
};

export type ContributionChartProps = {
  contributors: ContributionEntry[];
  className?: string;
};

/** Brightness ladder — the #1 contributor reads brightest, tailing to ash. */
const BAR_FILL = ["bg-on-dark", "bg-charcoal", "bg-body", "bg-mute", "bg-ash"];
const fillFor = (i: number) => BAR_FILL[Math.min(i, BAR_FILL.length - 1)];

export function ContributionChart({ contributors, className }: ContributionChartProps) {
  const rows = [...contributors]
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);
  const max = Math.max(1, ...rows.map((c) => c.commits));

  return (
    <Surface level={1} radius="lg" className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
          Contributions
        </h2>
        <span className="text-[12px] text-mute">by commit count</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-label text-mute">No contribution data yet.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2.5">
          {rows.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-[12px] text-ash tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-mono text-label text-body">{c.name}</span>
                  <span className="shrink-0 font-mono text-label text-ink tabular-nums">
                    <RollupNumber value={c.commits} />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className={cn("h-full rounded-full", fillFor(i))}
                    style={{ width: `${Math.max(4, (c.commits / max) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}
