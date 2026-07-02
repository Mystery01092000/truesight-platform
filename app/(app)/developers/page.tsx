import type { Metadata } from "next";
import { Code2, Users, ChevronRight, GitCommitVertical } from "lucide-react";

import { getGithubInsights, type GithubTeamView } from "@/lib/github/query";
import { getOrgLOCSummary, type RepoLOCBreakdown } from "@/lib/integrations/github/loc";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { Sparkline } from "@/components/ui/Sparkline";
import { LOCStats } from "@/components/widgets/LOCStats";
import { DevLeaderboard } from "@/components/widgets/DevLeaderboard";
import { ContributionChart } from "@/components/widgets/ContributionChart";

export const metadata: Metadata = { title: "Developer Portal" };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("en-US");

function fmtBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}

export default async function DevelopersPage() {
  const [insights, locSummary] = await Promise.all([
    getGithubInsights(),
    getOrgLOCSummary(),
  ]);

  const hasData = Boolean(insights) || locSummary.repoCount > 0;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-6xl">
        <Header
          org="centricitywealthtech"
          sub="Per-repo LOC metrics and developer contribution breakdowns."
        />
        <Reveal delay={0.1}>
          <EmptyState
            icon={<Code2 size={24} strokeWidth={1.5} />}
            title="Argus hasn't discovered any repositories yet"
            description="Run a GitHub sync to discover teams, members and repositories read-only — LOC metrics and contributor breakdowns will appear here."
          />
        </Reveal>
      </div>
    );
  }

  const org = locSummary.org ?? insights?.org ?? "centricitywealthtech";
  const locByRepo = new Map<string, RepoLOCBreakdown>();
  for (const r of locSummary.repos) locByRepo.set(r.name, r);

  const leaderboard = locSummary.topContributors.map((c) => ({
    name: c.login,
    github: c.login,
    commits: c.commits,
    loc: c.netLOC,
  }));

  const contribution = locSummary.topContributors.map((c) => ({
    name: c.login,
    commits: c.commits,
    additions: c.additions,
    deletions: c.deletions,
  }));

  const maxLangBytes = Math.max(1, ...locSummary.languages.map((l) => l.bytes));
  const teams = insights?.teams ?? [];
  const syncLine = locSummary.partial
    ? "Some repositories are still computing GitHub stats — partial data shown."
    : "Per-repo LOC metrics and developer contribution breakdowns.";

  return (
    <div className="mx-auto max-w-6xl">
      <Header org={org} sub={syncLine} partial={locSummary.partial} />

      {/* Org stat row */}
      <Reveal delay={0.05}>
        <LOCStats
          totalLOC={locSummary.totalLOC}
          repos={locSummary.repoCount}
          contributors={locSummary.contributorCount}
          commits={locSummary.commitsThisMonth}
        />
      </Reveal>

      {/* LOC trend + language distribution */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.08} className="lg:col-span-2">
          <Surface level={1} radius="lg" className="p-5">
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
                    <span className="ml-2 text-[13px] font-sans text-mute">net LOC</span>
                  </div>
                  <div className="mt-4">
                    <Sparkline data={locSummary.locTrend} width={640} height={64} strokeWidth={2} className="w-full" />
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-mute">LOC trend is still being computed by GitHub.</p>
              )}
            </div>
          </Surface>
        </Reveal>

        <Reveal delay={0.12}>
          <Surface level={1} radius="lg" className="flex h-full flex-col p-5">
            <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Languages
            </h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {locSummary.languages.slice(0, 8).map((l) => (
                <div key={l.language} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate font-mono text-[12px] text-body">
                    {l.language}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full bg-hairline-strong"
                      style={{ width: `${Math.max(6, (l.bytes / maxLangBytes) * 100)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[12px] text-mute tabular-nums">
                    {fmtBytes(l.bytes)}
                  </span>
                </div>
              ))}
              {locSummary.languages.length === 0 && (
                <p className="text-[13px] text-mute">No language metadata on repositories.</p>
              )}
            </div>
          </Surface>
        </Reveal>
      </div>

      {/* Top contributors + contribution breakdown */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={0.06}>
          <Surface level={1} radius="lg" className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Top contributors
              </h2>
              <span className="text-[12px] text-mute">by commit count</span>
            </div>
            <div className="mt-4">
              <DevLeaderboard contributors={leaderboard} />
            </div>
          </Surface>
        </Reveal>

        <Reveal delay={0.1}>
          <ContributionChart contributors={contribution} className="h-full" />
        </Reveal>
      </div>

      {/* Per-repo LOC breakdown */}
      <Reveal delay={0.05}>
        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Repository LOC
          </h2>
          <span className="font-mono text-[12px] text-mute tabular-nums">
            {locSummary.repos.length}
          </span>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {locSummary.repos.map((r, i) => (
          <Reveal key={`${r.owner}/${r.name}`} delay={0.03 * i}>
            <RepoLOCCard repo={r} />
          </Reveal>
        ))}
        {locSummary.repos.length === 0 && (
          <Reveal delay={0.05}>
            <Surface level={1} radius="lg" className="p-6 text-[13px] text-mute">
              No repository LOC metrics available yet.
            </Surface>
          </Reveal>
        )}
      </div>

      {/* Team explorer — Team → Member → Repo */}
      <Reveal delay={0.05}>
        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Teams
          </h2>
          <span className="font-mono text-[12px] text-mute tabular-nums">{teams.length}</span>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {teams.map((t, i) => (
          <Reveal key={t.urn} delay={0.02 * i}>
            <TeamExplorer team={t} locByRepo={locByRepo} />
          </Reveal>
        ))}
        {teams.length === 0 && (
          <Reveal delay={0.05}>
            <Surface level={1} radius="lg" className="col-span-full p-6 text-[13px] text-mute">
              No team membership graph discovered — LOC metrics are shown per repository above.
            </Surface>
          </Reveal>
        )}
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
            <span className="mx-1.5" aria-hidden>·</span>
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

function RepoLOCCard({ repo }: { repo: RepoLOCBreakdown }) {
  const hasTrend = repo.trend.length >= 2;
  return (
    <Surface level={1} radius="lg" className="group flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <AppIconTile kind="repo" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[13px] text-ink">{repo.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-mute">
            {repo.language ? (
              <Badge className="font-mono">{repo.language}</Badge>
            ) : (
              <span className="font-mono">—</span>
            )}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Users size={11} strokeWidth={1.75} /> {repo.contributorCount}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="font-display text-[22px] font-medium leading-none tracking-[-0.3px] text-ink tabular-nums">
            {nf.format(repo.netLOC)}
          </div>
          <div className="mt-1 text-[11px] text-mute">net LOC</div>
        </div>
        {hasTrend && (
          <Sparkline data={repo.trend} width={96} height={28} strokeWidth={1.5} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5 text-[12px] text-mute">
        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
          <GitCommitVertical size={12} strokeWidth={1.75} />
          +{nf.format(repo.additions)} / −{nf.format(repo.deletions)}
        </span>
        <span className="font-mono">{repo.owner}</span>
      </div>
    </Surface>
  );
}

function TeamExplorer({
  team,
  locByRepo,
}: {
  team: GithubTeamView;
  locByRepo: Map<string, RepoLOCBreakdown>;
}) {
  return (
    <Surface level={1} radius="lg" className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <AppIconTile kind="team" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              {team.name}
            </div>
            <div className="mt-0.5 truncate font-mono text-[12px] text-mute">{team.slug}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge className="font-mono tabular-nums">
              <Users size={11} strokeWidth={1.75} /> {team.memberCount}
            </Badge>
            <Badge className="font-mono tabular-nums">{team.repoCount} repos</Badge>
            <ChevronRight
              size={16}
              className="text-mute transition-transform duration-200 group-open:rotate-90"
              aria-hidden
            />
          </div>
        </summary>

        <div className="border-t border-hairline px-4 pb-4 pt-3">
          <div className="text-[11px] uppercase tracking-[0.6px] text-ash">Members</div>
          {team.members.length === 0 ? (
            <p className="mt-2 text-[12px] text-mute">—</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {team.members.slice(0, 12).map((m) => {
                const memberLoc = m.topRepos.reduce((s, r) => {
                  const loc = locByRepo.get(r.repo)?.netLOC ?? 0;
                  return s + loc;
                }, 0);
                return (
                  <details key={m.urn} className="group/m rounded-md">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-elevated [&::-webkit-details-marker]:hidden">
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-full border border-hairline bg-surface-card font-mono text-[10px] uppercase text-body"
                        aria-hidden
                      >
                        {m.login.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-body">
                        {m.login}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-mute tabular-nums">
                        {nf.format(m.contributions)} commits
                      </span>
                      <ChevronRight
                        size={13}
                        className="shrink-0 text-ash transition-transform duration-200 group-open/m:rotate-90"
                        aria-hidden
                      />
                    </summary>
                    <div className="ml-8 mt-1 flex flex-col gap-1 border-l border-hairline pl-3 pb-1">
                      <div className="text-[11px] text-mute">
                        {m.repoContributedCount} repos · {m.teamCount}{" "}
                        {m.teamCount === 1 ? "team" : "teams"}
                        {memberLoc > 0 && (
                          <span className="ml-1.5 font-mono tabular-nums">
                            · {nf.format(memberLoc)} loc touched
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {m.topRepos.map((r) => {
                          const loc = locByRepo.get(r.repo)?.netLOC ?? 0;
                          return (
                            <span
                              key={r.repo}
                              className="rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[11px] text-body"
                            >
                              {r.repo}
                              <span className="ml-1.5 text-mute tabular-nums">
                                {nf.format(r.contributions)}
                              </span>
                              {loc > 0 && (
                                <span className="ml-1.5 text-ash tabular-nums">
                                  {nf.format(loc)} loc
                                </span>
                              )}
                            </span>
                          );
                        })}
                        {m.topRepos.length === 0 && (
                          <span className="text-[12px] text-mute">No repo contributions</span>
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
              {team.members.length > 12 && (
                <span className="px-2 py-1 font-mono text-[12px] text-mute tabular-nums">
                  +{team.members.length - 12} more
                </span>
              )}
            </div>
          )}

          <div className="mt-3 text-[11px] uppercase tracking-[0.6px] text-ash">Repositories</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {team.repos.slice(0, 8).map((r) => {
              const loc = locByRepo.get(r.name)?.netLOC ?? null;
              return (
                <span
                  key={r.urn}
                  className="rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[12px] text-body"
                >
                  {r.name}
                  {loc !== null && (
                    <span className="ml-1.5 text-mute tabular-nums">{nf.format(loc)} loc</span>
                  )}
                </span>
              );
            })}
            {team.repos.length > 8 && (
              <span className="px-1 py-1 font-mono text-[12px] text-mute tabular-nums">
                +{team.repos.length - 8}
              </span>
            )}
            {team.repos.length === 0 && <span className="text-[12px] text-mute">—</span>}
          </div>
        </div>
      </details>
    </Surface>
  );
}
