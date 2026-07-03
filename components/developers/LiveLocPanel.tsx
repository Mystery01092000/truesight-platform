"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/ui/Sparkline";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/utils/cn";

/**
 * LiveLocPanel — on-demand GitHub statistics island for the Developer Portal.
 * The org LOC sweep fans live GitHub Stats API calls across every repo
 * (minutes on a cold cache), so it never blocks the server render: the panel
 * idles until the user asks for it, then reads GET /api/developers (shared
 * "developers:summary" cache).
 */

type LiveContributor = {
  login: string;
  commits: number;
  additions: number;
  deletions: number;
  netLOC: number;
};

type LiveLocSummary = {
  totalLOC: number;
  totalAdditions: number;
  totalDeletions: number;
  repoCount: number;
  discoveredRepos: number;
  contributorCount: number;
  commitsThisMonth: number;
  topContributors: LiveContributor[];
  locTrend: number[];
  partial: boolean;
  generatedAt: string;
};

const nf = new Intl.NumberFormat("en-US");

/** A gateway 502/504 — the sweep outlived the proxy window but keeps running server-side. */
class GatewayTimeoutError extends Error {
  constructor(status: number) {
    super(`The gateway gave up waiting (${status}) — the sweep is still running server-side.`);
    this.name = "GatewayTimeoutError";
  }
}

async function fetchLiveSummary(): Promise<LiveLocSummary> {
  let res: Response;
  try {
    res = await fetch("/api/developers", { headers: { accept: "application/json" } });
  } catch {
    throw new Error("Network error — the developers API is unreachable.");
  }
  if (res.status === 502 || res.status === 504) {
    throw new GatewayTimeoutError(res.status);
  }
  if (!res.ok) {
    const message = await res
      .json()
      .then((body: { message?: string }) => body?.message)
      .catch(() => undefined);
    throw new Error(message || `The developers API responded with ${res.status}.`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: LiveLocSummary };
  if (!body.ok || !body.data) {
    throw new Error("The developers API returned a malformed payload.");
  }
  return body.data;
}

export type LiveLocPanelProps = {
  /** True when `developer_stats` hasn't materialized — idle copy adapts. */
  rollupStale?: boolean;
  className?: string;
};

export function LiveLocPanel({ rollupStale = false, className }: LiveLocPanelProps) {
  const { data, error, isError, isFetching, refetch } = useQuery({
    queryKey: ["developers", "live-loc-summary"],
    queryFn: fetchLiveSummary,
    enabled: false,
    retry: false,
  });

  return (
    <Surface level={1} radius="lg" className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
          Live GitHub stats
        </h2>
        <span className="text-[12px] text-mute">
          {data ? "weekly net additions · last 26 weeks" : "loaded on demand"}
        </span>
      </div>

      <div className="mt-5">
        {isFetching ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : String(error)}
            stillRunning={error instanceof GatewayTimeoutError}
            onRetry={() => refetch()}
          />
        ) : data ? (
          <SummaryView data={data} rollupStale={rollupStale} />
        ) : (
          <IdleState rollupStale={rollupStale} onLoad={() => refetch()} />
        )}
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */

function IdleState({ rollupStale, onLoad }: { rollupStale: boolean; onLoad: () => void }) {
  return (
    <div>
      <p className="text-label leading-[1.6] text-mute">
        {rollupStale
          ? "The materialized rollup hasn't landed yet, so nothing is precomputed — live LOC velocity, contributor and trend stats can still be loaded on demand from GitHub."
          : "LOC velocity and the org-wide weekly trend come from GitHub's statistics engine. Load them when you need them — a cold sweep touches every repository."}
      </p>
      <Button variant="tertiary" size="sm" className="mt-4" onClick={onLoad}>
        <Activity size={13} strokeWidth={1.75} aria-hidden />
        Load live GitHub stats
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy>
      <Skeleton.Block className="h-9 w-44" />
      <Skeleton.Block className="mt-4 h-16 w-full" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton.Row key={i} />
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-[1.5] text-mute">
        Sweeping GitHub&apos;s statistics API — a cold sweep across every repository can take a
        few minutes.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  stillRunning,
  onRetry,
}: {
  message: string;
  stillRunning: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert">
      <p className="text-label leading-[1.6] text-critical">{message}</p>
      <p className="mt-1 text-[12px] leading-[1.5] text-mute">
        {stillRunning
          ? "A cold sweep can outlive the gateway's timeout while the server keeps computing — retry in a minute or two to pick up the finished result."
          : "Live GitHub stats couldn't be loaded. Retry, or check your session and GitHub connectivity."}
      </p>
      <Button variant="tertiary" size="sm" className="mt-4" onClick={onRetry}>
        <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
        Retry
      </Button>
    </div>
  );
}

function SummaryView({ data, rollupStale }: { data: LiveLocSummary; rollupStale: boolean }) {
  return (
    <div>
      <div className="font-display text-[34px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
        {nf.format(data.totalLOC)}
        <span className="ml-2 font-sans text-label text-mute">net LOC</span>
      </div>

      {data.locTrend.length >= 2 ? (
        <div className="mt-4">
          <Sparkline
            data={data.locTrend}
            width={640}
            height={64}
            strokeWidth={2}
            className="w-full"
          />
        </div>
      ) : (
        <p className="mt-4 text-label text-mute">LOC trend is still being computed by GitHub.</p>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-4">
        <MetaStat label="Repositories" value={data.repoCount} />
        <MetaStat label="Contributors" value={data.contributorCount} />
        <MetaStat label="Commits this month" value={data.commitsThisMonth} />
      </dl>

      {data.partial && (
        <p className="mt-4 flex items-center gap-2 text-[12px] leading-[1.5] text-mute">
          <Badge variant="info-soft">Partial</Badge>
          Some repositories are still computing GitHub stats — partial data shown.
        </p>
      )}

      {rollupStale && data.topContributors.length > 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          <h3 className="text-label font-medium leading-[1.5] tracking-[0.015em] text-mute">
            Top contributors (live)
          </h3>
          <ul className="mt-3 space-y-2">
            {data.topContributors.map((c) => (
              <li key={c.login} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-label text-body">{c.login}</span>
                <span className="shrink-0 font-mono text-[12px] text-mute tabular-nums">
                  {nf.format(c.netLOC)} LOC · {nf.format(c.commits)} commits
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-label font-medium leading-[1.5] tracking-[0.015em] text-mute">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[18px] font-medium leading-none text-ink tabular-nums">
        {nf.format(value)}
      </dd>
    </div>
  );
}
