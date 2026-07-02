import { Code2, FolderGit2, GitCommitVertical, Users } from "lucide-react";

import { StatTile } from "@/components/ui/StatTile";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils/cn";

/**
 * LOCStats — the Developer Portal's hero stat row, composed from the shared
 * StatTile primitive: developers, repositories, total net LOC (with the
 * org-wide weekly trend as a sparkline when available) and total commits.
 */
export type LOCStatsProps = {
  developers: number;
  repos: number;
  totalLoc: number;
  commits: number;
  /** Weekly net-LOC series; renders under the LOC tile when ≥2 points. */
  locTrend?: number[];
  className?: string;
};

export function LOCStats({
  developers,
  repos,
  totalLoc,
  commits,
  locTrend,
  className,
}: LOCStatsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      <StatTile
        label="Developers"
        value={developers}
        icon={<Users strokeWidth={1.75} />}
      />
      <StatTile
        label="Repositories"
        value={repos}
        icon={<FolderGit2 strokeWidth={1.75} />}
      />
      <StatTile
        label="Total LOC"
        value={totalLoc}
        icon={<Code2 strokeWidth={1.75} />}
        sparkline={
          locTrend && locTrend.length >= 2 ? (
            <Sparkline data={locTrend} width={220} height={32} className="w-full" />
          ) : undefined
        }
      />
      <StatTile
        label="Commits"
        value={commits}
        icon={<GitCommitVertical strokeWidth={1.75} />}
      />
    </div>
  );
}
