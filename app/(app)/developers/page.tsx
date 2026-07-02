import type { Metadata } from "next";
import { Code2 } from "lucide-react";

import { getOrgLOCSummary } from "@/lib/integrations/github/loc";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sparkline } from "@/components/ui/Sparkline";
import { LOCStats } from "@/components/widgets/LOCStats";
import { DevLeaderboard, type DeveloperRow } from "@/components/widgets/DevLeaderboard";
import { ContributionChart } from "@/components/widgets/ContributionChart";
import { DevRefreshButton } from "@/components/widgets/DevRefreshButton";

import { getDeveloperRollups } from "./data";

export const metadata: Metadata = { title: "Developer Portal" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("en-US");

export default async function DevelopersPage() {
  // Same entry points the /api/developers routes serve: the org LOC summary
  // (GitHub statistics engine, cached + best-effort) and the materialized
  // per-developer rollup it upserts into `developer_stats`.
  const [locSummary, rollup, session] = await Promise.all([
    getOrgLOCSummary(),
    getDeveloperRollups(),
    getSession(),
  ]);
  const canRefresh = session ? can(session.role, "sync:trigger") : false;

  const hasData = !rollup.stale || locSummary.repoCount > 0;
  if (!hasData) {
    return (
      <div className="mx-auto max-w-6xl">
        <Header
          org="centricitywealthtech"
          sub="Per-developer LOC metrics, contribution rankings and stack coverage."
        />
        <Reveal delay={0.1}>
          <EmptyState
            icon={<Code2 size={24} strokeWidth={1.5} />}
            title="Argus hasn't discovered any repositories yet"
            description="Run a GitHub sync to discover teams, members and repositories read-only — developer LOC metrics and rankings will appear here."
          />
        </Reveal>
      </div>
    );
  }

  const org = locSummary.org ?? "centricitywealthtech";

  // Prefer the materialized rollup (team + languages + repo counts); fall back
  // to the live summary's top contributors while the first rollup lands.
  const developers: DeveloperRow[] = !rollup.stale
    ? rollup.developers
    : locSummary.topContributors
        .map((c) => ({
          login: c.login,
          team: null,
          totalLoc: c.netLOC,
          additions: c.additions,
          deletions: c.deletions,
          commits: c.commits,
          topLanguages: [],
          repoCount: 0,
        }))
        .sort((a, b) => b.totalLoc - a.totalLoc || a.login.localeCompare(b.login));

  const stats = {
    developers: !rollup.stale ? rollup.totals.developerCount : locSummary.contributorCount,
    repos: !rollup.stale ? rollup.totals.repoCount : locSummary.repoCount,
    totalLoc: !rollup.stale ? rollup.totals.totalLoc : locSummary.totalLOC,
    commits: !rollup.stale
      ? rollup.totals.commits
      : developers.reduce((n, d) => n + d.commits, 0),
  };

  const contribution = developers.slice(0, 10).map((d) => ({
    name: d.login,
    commits: d.commits,
    additions: d.additions,
    deletions: d.deletions,
  }));

  const syncLine = locSummary.partial
    ? "Some repositories are still computing GitHub stats — partial data shown."
    : "Per-developer LOC metrics, contribution rankings and stack coverage.";

  return (
    <div className="mx-auto max-w-6xl">
      <Header org={org} sub={syncLine} partial={locSummary.partial} />

      {/* Org stat row */}
      <Reveal delay={0.05}>
        <LOCStats
          developers={stats.developers}
          repos={stats.repos}
          totalLoc={stats.totalLoc}
          commits={stats.commits}
          locTrend={locSummary.locTrend}
        />
      </Reveal>

      {/* Developer directory */}
      <Reveal delay={0.08}>
        <div className="mt-8 mb-4 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Developers
          </h2>
          <span className="font-mono text-[12px] text-mute tabular-nums">
            {developers.length}
          </span>
          {rollup.stale && developers.length > 0 && (
            <Badge variant="info-soft">Live summary — rollup pending</Badge>
          )}
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        {developers.length > 0 ? (
          <DevLeaderboard developers={developers} />
        ) : (
          <EmptyState
            icon={<Code2 size={24} strokeWidth={1.5} />}
            title="No contributor activity computed yet"
            description={
              canRefresh
                ? "GitHub is still computing repository statistics. Refresh the LOC engine to trigger another pass."
                : "GitHub is still computing repository statistics. Metrics appear here once the first pass lands."
            }
            action={canRefresh ? <DevRefreshButton /> : undefined}
          />
        )}
      </Reveal>

      {/* LOC velocity + contribution breakdown */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.06} className="lg:col-span-2">
          <Surface level={1} radius="lg" className="h-full p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                LOC velocity
              </h2>
              <span className="text-[12px] text-mute">weekly net additions · last 26 weeks</span>
            </div>
            <div className="mt-5">
              {locSummary.locTrend.length >= 2 ? (
                <>
                  <div className="font-display text-[34px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                    {nf.format(locSummary.totalLOC)}
                    <span className="ml-2 font-sans text-[13px] text-mute">net LOC</span>
                  </div>
                  <div className="mt-4">
                    <Sparkline
                      data={locSummary.locTrend}
                      width={640}
                      height={64}
                      strokeWidth={2}
                      className="w-full"
                    />
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-mute">
                  LOC trend is still being computed by GitHub.
                </p>
              )}
            </div>
          </Surface>
        </Reveal>

        <Reveal delay={0.1}>
          <ContributionChart contributors={contribution} className="h-full" />
        </Reveal>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Header({ org, sub, partial }: { org: string; sub: string; partial?: boolean }) {
  return (
    <Reveal>
      <header className="mb-8 flex items-start gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
          aria-hidden
        >
          <Code2 size={22} strokeWidth={1.75} className="text-iris" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Developer Portal
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            <span className="font-mono text-body">{org}</span>
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            {sub}
          </p>
        </div>
        {partial && (
          <Badge variant="info-soft" className="mt-1 shrink-0">
            Partial
          </Badge>
        )}
      </header>
    </Reveal>
  );
}
