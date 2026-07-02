import { GitCommitVertical } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * DevRepoHighlights — a developer's top repositories by net LOC, ranked with
 * the monochrome brightness ladder (brightest bar = biggest footprint) so the
 * podium reads at a glance without saturated accent. Rows deep-link to the
 * repository on GitHub.
 */
export type RepoHighlight = {
  /** Full name ("owner/name") — used for the GitHub link. */
  repo: string;
  /** Short display name. */
  name: string;
  loc: number;
  additions: number;
  deletions: number;
  commits: number;
};

const BAR_FILL = ["bg-on-dark", "bg-charcoal", "bg-body", "bg-mute", "bg-ash"];
const fillFor = (i: number) => BAR_FILL[Math.min(i, BAR_FILL.length - 1)];

const nf = new Intl.NumberFormat("en-US");

export function DevRepoHighlights({
  repos,
  limit = 5,
  className,
}: {
  /** Pre-sorted by net LOC descending. */
  repos: RepoHighlight[];
  limit?: number;
  className?: string;
}) {
  const rows = repos.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.loc)));

  if (rows.length === 0) {
    return (
      <p className={cn("text-[13px] leading-[1.6] text-mute", className)}>
        No per-repository contributions recorded yet.
      </p>
    );
  }

  return (
    <ol className={cn("flex flex-col gap-1", className)}>
      {rows.map((r, i) => (
        <li key={r.repo} className="flex items-center gap-3 rounded-md px-1.5 py-1.5">
          <span className="w-5 shrink-0 text-right font-mono text-[12px] text-ash tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <a
                href={`https://github.com/${r.repo}`}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[13px] text-ink underline-offset-4 transition-colors duration-150 ease-smooth hover:underline"
              >
                {r.name}
              </a>
              <span className="shrink-0 font-mono text-[13px] text-ink tabular-nums">
                {nf.format(r.loc)} <span className="text-[11px] text-mute">loc</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className={cn("h-full rounded-full", fillFor(i))}
                style={{ width: `${Math.max(4, (Math.abs(r.loc) / max) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-mute tabular-nums">
              <span className="text-positive">+{nf.format(r.additions)}</span>
              <span className="text-critical">−{nf.format(r.deletions)}</span>
              <span className="inline-flex items-center gap-1 text-ash">
                <GitCommitVertical size={11} strokeWidth={1.75} aria-hidden />
                {nf.format(r.commits)} commits
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
