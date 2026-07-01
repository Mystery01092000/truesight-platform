import type { Metadata } from "next";
import { Users, ChevronRight, Star } from "lucide-react";

import { getGithubInsights, type GithubTeamView } from "@/lib/github/query";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "GitHub" };
export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
const nf = new Intl.NumberFormat("en-US");

/* -------------------------------------------------------------------------- */

export default async function GithubPage() {
  // Real discovered org graph from the KB (resources + edges) — never mocked.
  const insights = await getGithubInsights();

  if (!insights) {
    return (
      <div className="mx-auto max-w-6xl">
        <Header org="centricitywealthtech" sub="Org insights — Team → Member → Repo, read-only." />
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-lg border border-hairline bg-surface-card">
              <Users size={24} strokeWidth={1.5} className="text-mute" />
            </div>
            <h2 className="mt-4 text-[18px] font-medium leading-[1.4] text-ink">
              No GitHub org discovered yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
              Argus hasn&rsquo;t enumerated the organization. Run{" "}
              <code className="font-mono text-[13px] text-mute">tsx db/github-sync-cli.ts</code> to
              discover teams, members and repositories read-only — they&rsquo;ll appear here as
              insights.
            </p>
          </Surface>
        </Reveal>
      </div>
    );
  }

  const { org, counts, teams, topContributors, topRepos, languages, lastSync } = insights;
  const syncLine =
    lastSync?.startedAt != null
      ? `Last sync ${fmtDate(lastSync.startedAt)} · ${lastSync.status}`
      : "Org insights — Team → Member → Repo, read-only.";

  const stats = [
    { label: "Teams", value: counts.teams },
    { label: "Members", value: counts.members },
    { label: "Repositories", value: counts.repos },
    { label: "Contributions", value: counts.contributions },
  ];

  const maxContrib = Math.max(1, ...topContributors.map((m) => m.contributions));
  const maxLang = Math.max(1, ...languages.map((l) => l.count));

  return (
    <div className="mx-auto max-w-6xl">
      <Header org={org} sub={syncLine} />

      {/* Org overview — hero numerals in the display voice. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <Surface level={1} radius="lg" className="p-5">
              <div className="text-[13px] text-mute">{s.label}</div>
              <div className="mt-2 font-display text-[40px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                {nf.format(s.value)}
              </div>
            </Surface>
          </Reveal>
        ))}
      </div>

      {/* Insight row: top contributors + languages. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.05} className="lg:col-span-2">
          <Surface level={1} radius="lg" className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Top contributors
              </h2>
              <span className="text-[12px] text-mute">by contribution count</span>
            </div>
            <ol className="mt-4 flex flex-col gap-1">
              {topContributors.map((m, i) => (
                <li key={m.urn} className="flex items-center gap-3 rounded-md px-1.5 py-1.5">
                  <span className="w-5 shrink-0 text-right font-mono text-[12px] text-ash tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-mono text-[13px] text-body">{m.login}</span>
                      <span className="shrink-0 font-mono text-[13px] text-ink tabular-nums">
                        {nf.format(m.contributions)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-full rounded-full bg-iris-soft"
                        style={{ width: `${Math.max(4, (m.contributions / maxContrib) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-mute tabular-nums">
                    {m.teamCount} {m.teamCount === 1 ? "team" : "teams"}
                  </span>
                </li>
              ))}
            </ol>
          </Surface>
        </Reveal>

        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-5">
            <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Languages
            </h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {languages.slice(0, 8).map((l) => (
                <div key={l.language} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate font-mono text-[12px] text-body">
                    {l.language}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full bg-hairline-strong"
                      style={{ width: `${Math.max(6, (l.count / maxLang) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[12px] text-mute tabular-nums">
                    {l.count}
                  </span>
                </div>
              ))}
              {languages.length === 0 && (
                <p className="text-[13px] text-mute">No language metadata on repositories.</p>
              )}
            </div>
          </Surface>
        </Reveal>
      </div>

      {/* Most active repositories. */}
      <Reveal delay={0.05}>
        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Most active repositories
          </h2>
          <span className="text-[12px] text-mute">by contributions</span>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topRepos.map((r, i) => (
          <Reveal key={r.urn} delay={0.03 * i}>
            <Surface level={1} radius="lg" className="flex h-full flex-col p-4">
              <div className="flex items-start gap-3">
                <AppIconTile kind="repo" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[13px] text-ink">{r.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-mute">
                    <span className="font-mono">{r.language ?? "—"}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Star size={11} strokeWidth={1.75} /> {r.stars}
                    </span>
                    {r.archived && <Badge className="ml-auto">Archived</Badge>}
                  </div>
                </div>
              </div>
              {r.description && (
                <p className="mt-2.5 line-clamp-2 text-[12px] leading-[1.5] text-body">
                  {r.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5 text-[12px] text-mute">
                <span className="font-mono tabular-nums">
                  {nf.format(r.totalContributions)} commits · {r.contributorCount} contrib
                </span>
                <span className="font-mono">{fmtDate(r.pushedAt)}</span>
              </div>
            </Surface>
          </Reveal>
        ))}
      </div>

      {/* Team explorer — Team → members → repos, drill-down secondary. */}
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
            <TeamCard team={t} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Header({ org, sub }: { org: string; sub: string }) {
  return (
    <Reveal>
      <header className="mb-8 flex items-start gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
          aria-hidden
        >
          <Users size={22} strokeWidth={1.75} className="text-iris" />
        </span>
        <div>
          <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            GitHub
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            <span className="font-mono text-body">{org}</span>
            <span className="mx-1.5" aria-hidden>·</span>
            {sub}
          </p>
        </div>
      </header>
    </Reveal>
  );
}

function TeamCard({ team }: { team: GithubTeamView }) {
  const previewMembers = team.members.slice(0, 6);
  const previewRepos = team.repos.slice(0, 6);
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewMembers.map((m) => (
              <span
                key={m.urn}
                className="rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[12px] text-body"
              >
                {m.login}
              </span>
            ))}
            {team.members.length > previewMembers.length && (
              <span className="px-1 py-1 font-mono text-[12px] text-mute tabular-nums">
                +{team.members.length - previewMembers.length}
              </span>
            )}
            {team.members.length === 0 && <span className="text-[12px] text-mute">—</span>}
          </div>

          <div className="mt-3 text-[11px] uppercase tracking-[0.6px] text-ash">Repositories</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewRepos.map((r) => (
              <span
                key={r.urn}
                className="rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[12px] text-body"
              >
                {r.name}
              </span>
            ))}
            {team.repos.length > previewRepos.length && (
              <span className="px-1 py-1 font-mono text-[12px] text-mute tabular-nums">
                +{team.repos.length - previewRepos.length}
              </span>
            )}
            {team.repos.length === 0 && <span className="text-[12px] text-mute">—</span>}
          </div>
        </div>
      </details>
    </Surface>
  );
}
