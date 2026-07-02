import { Surface } from "@/components/ui/Surface";
import { RollupNumber } from "@/components/ui/RollupNumber";
import { cn } from "@/lib/utils/cn";

/**
 * LOCStats — the Developer Portal's hero stat row. Four count-up tiles (total
 * LOC, active repos, contributors, commits this month) on the surface ladder.
 */
export type LOCStatsProps = {
  totalLOC: number;
  repos: number;
  contributors: number;
  commits: number;
  className?: string;
};

export function LOCStats({ totalLOC, repos, contributors, commits, className }: LOCStatsProps) {
  const cards = [
    { label: "Total LOC", value: totalLOC },
    { label: "Active repos", value: repos },
    { label: "Contributors", value: contributors },
    { label: "Commits this month", value: commits },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {cards.map((c) => (
        <Surface key={c.label} level={1} radius="lg" className="p-5">
          <div className="text-[13px] text-mute">{c.label}</div>
          <div className="mt-2 font-display text-[40px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
            <RollupNumber value={c.value} />
          </div>
        </Surface>
      ))}
    </div>
  );
}
