import type { Metadata } from "next";
import { Code2 } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LOCStats } from "@/components/widgets/LOCStats";
import { DevLeaderboard, type DeveloperRow } from "@/components/widgets/DevLeaderboard";
import { ContributionChart } from "@/components/widgets/ContributionChart";
import { DevRefreshButton } from "@/components/widgets/DevRefreshButton";
import { LiveLocPanel } from "@/components/developers/LiveLocPanel";

import { getDeveloperRollups } from "./data";

export const metadata: Metadata = { title: "Developer Portal" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  // Render instantly from the materialized `developer_stats` rollup; the live
  // GitHub statistics sweep (minutes on a cold cache) never blocks first paint
  // — the LiveLocPanel island loads it on demand via GET /api/developers.
  const [rollup, session] = await Promise.all([getDeveloperRollups(), getSession()]);
  const canRefresh = session ? can(session.role, "sync:trigger") : false;

  const developers: DeveloperRow[] = rollup.stale ? [] : rollup.developers;

  const contribution = developers.slice(0, 10).map((d) => ({
    name: d.login,
    commits: d.commits,
    additions: d.additions,
    deletions: d.deletions,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <Header
        org="centricitywealthtech"
        sub="Per-developer LOC metrics, contribution rankings and stack coverage."
      />

      {/* Org stat row — materialized rollup only; skipped honestly while stale */}
      {!rollup.stale && (
        <Reveal delay={0.05}>
          <LOCStats
            developers={rollup.totals.developerCount}
            repos={rollup.totals.repoCount}
            totalLoc={rollup.totals.totalLoc}
            commits={rollup.totals.commits}
          />
        </Reveal>
      )}

      {/* Developer directory */}
      <Reveal delay={0.08}>
        <div className="mt-8 mb-4 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Developers
          </h2>
          <span className="font-mono text-[12px] text-mute tabular-nums">
            {developers.length}
          </span>
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
                ? "The developer rollup hasn't materialized. Refresh the LOC engine to trigger a pass, or load live GitHub stats below."
                : "The developer rollup hasn't materialized. Load live GitHub stats below, or wait for the first pass to land."
            }
            action={canRefresh ? <DevRefreshButton /> : undefined}
          />
        )}
      </Reveal>

      {/* Live GitHub stats island + contribution breakdown */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal
          delay={0.06}
          className={contribution.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}
        >
          <LiveLocPanel rollupStale={rollup.stale} className="h-full" />
        </Reveal>
        {contribution.length > 0 && (
          <Reveal delay={0.1}>
            <ContributionChart contributors={contribution} className="h-full" />
          </Reveal>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Header({ org, sub }: { org: string; sub: string }) {
  return (
    <Reveal>
      <PageHeader
        title="Developer Portal"
        iconTone="iris"
        icon={<Code2 size={22} strokeWidth={1.75} className="text-iris" />}
        description={
          <>
            <span className="font-mono text-body">{org}</span>
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            {sub}
          </>
        }
      />
    </Reveal>
  );
}
