import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  FolderGit2,
  GitCommitVertical,
  UserRound,
} from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { RollupNumber } from "@/components/ui/RollupNumber";
import { DevStackCoverage } from "@/components/widgets/DevStackCoverage";
import { DevRepoHighlights } from "@/components/widgets/DevRepoHighlights";
import { DevRefreshButton } from "@/components/widgets/DevRefreshButton";

import { getDeveloperProfile, type DeveloperProfile } from "../data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ login: string }>;
}): Promise<Metadata> {
  const { login } = await params;
  return { title: `Developer · ${decodeURIComponent(login)}` };
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Service identity derived from a repo's short name — common platform
 *  prefixes/suffixes are stripped so `argus-frontend` and `argus-api`
 *  collapse into the one `argus` service chip. */
function serviceOf(name: string): string {
  const stripped = name
    .toLowerCase()
    .replace(/^(iac|infra|svc|service|app)[-_]/, "")
    .replace(
      /[-_](frontend|backend|api|ui|web|app|service|svc|server|client|infra|infrastructure|worker|lambda|jobs?|cdk|terraform)$/,
      "",
    );
  return stripped || name.toLowerCase();
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login: raw } = await params;
  const login = decodeURIComponent(raw);

  const [profile, session] = await Promise.all([
    getDeveloperProfile(login),
    getSession(),
  ]);
  const canRefresh = session ? can(session.role, "sync:trigger") : false;

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl">
        <ProfileHeader login={login} team={null} />
        <Reveal delay={0.08}>
          <EmptyState
            icon={<UserRound size={24} strokeWidth={1.5} />}
            title={`Argus hasn't computed stats for ${login} yet`}
            description={
              canRefresh
                ? "The developer stats rollup has no rows for this login. Refresh the LOC engine to recompute per-developer metrics straight from GitHub."
                : "The developer stats rollup has no rows for this login. Ask an operator or admin to refresh developer stats from the portal."
            }
            action={canRefresh ? <DevRefreshButton /> : undefined}
          />
        </Reveal>
      </div>
    );
  }

  const services = [...new Set(profile.repos.map((r) => serviceOf(r.name)))].sort();

  return (
    <div className="mx-auto max-w-6xl">
      <ProfileHeader login={profile.login} team={profile.team} />

      {/* Contribution stat row */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Net LOC"
            value={profile.totalLoc}
            icon={<Code2 strokeWidth={1.75} />}
          />
          <ChurnTile additions={profile.additions} deletions={profile.deletions} />
          <StatTile
            label="Commits"
            value={profile.commits}
            icon={<GitCommitVertical strokeWidth={1.75} />}
          />
          <StatTile
            label="Repositories"
            value={profile.repoCount}
            icon={<FolderGit2 strokeWidth={1.75} />}
          />
        </div>
      </Reveal>

      {/* Stack coverage + services touched */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={0.08}>
          <Surface level={1} radius="lg" className="h-full p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Stack coverage
              </h2>
              <span className="text-[12px] text-mute">byte-weighted across repos</span>
            </div>
            <DevStackCoverage languages={profile.languages} className="mt-5" />
          </Surface>
        </Reveal>

        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="h-full p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Services touched
              </h2>
              <span className="font-mono text-[12px] text-mute tabular-nums">
                {services.length}
              </span>
            </div>
            {services.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-surface-elevated px-2.5 py-1 font-mono text-[12px] text-body"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-label leading-[1.6] text-mute">
                No repository contributions recorded yet.
              </p>
            )}
          </Surface>
        </Reveal>
      </div>

      {/* Highlights — top repos by net LOC */}
      <Reveal delay={0.06}>
        <Surface level={1} radius="lg" className="mt-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Highlights
            </h2>
            <span className="text-[12px] text-mute">top repositories by net LOC</span>
          </div>
          <DevRepoHighlights repos={profile.repos} className="mt-4" />
        </Surface>
      </Reveal>

      {profile.computedAt && (
        <Reveal delay={0.08}>
          <p className="mt-4 text-[12px] leading-[1.5] text-ash">
            Stats computed {dateFmt.format(new Date(profile.computedAt))} UTC · refreshed by
            the LOC engine.
          </p>
        </Reveal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProfileHeader({
  login,
  team,
}: {
  login: string;
  team: DeveloperProfile["team"];
}) {
  return (
    <Reveal>
      <div className="mb-5">
        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-label leading-[1.6] text-mute transition-colors hover:text-body"
        >
          <ArrowLeft size={14} />
          Developer Portal
        </Link>
      </div>
      <header className="mb-8 flex items-start gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://github.com/${encodeURIComponent(login)}.png?size=128`}
          width={44}
          height={44}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-11 shrink-0 rounded-full border border-hairline bg-surface-card"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[22px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              {login}
            </h1>
            {team && <Badge className="font-mono">{team}</Badge>}
          </div>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            <a
              href={`https://github.com/${encodeURIComponent(login)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-body transition-colors duration-150 ease-smooth hover:text-on-dark"
            >
              github.com/{login}
              <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
            </a>
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            LOC, churn and stack coverage from the GitHub statistics engine.
          </p>
        </div>
      </header>
    </Reveal>
  );
}

/** StatTile's value color is fixed to ink, so the +/− churn pair renders as a
 *  local tile in the same skin with semantic positive/critical figures. */
function ChurnTile({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <span className="text-label font-medium leading-[1.5] tracking-[0.015em] text-mute">
        Additions / Deletions
      </span>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <RollupNumber
          value={additions}
          prefix="+"
          className="font-mono text-[22px] font-medium leading-none text-positive"
        />
        <span className="font-mono text-[16px] leading-none text-ash" aria-hidden>
          /
        </span>
        <RollupNumber
          value={deletions}
          prefix="−"
          className="font-mono text-[22px] font-medium leading-none text-critical"
        />
      </div>
    </div>
  );
}
