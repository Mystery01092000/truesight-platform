import { NextResponse } from "next/server";

import { db } from "@/db";
import { developerStats } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeveloperRollup {
  login: string;
  team: string | null;
  totalLoc: number;
  additions: number;
  deletions: number;
  commits: number;
  topLanguages: Array<{ language: string; loc: number }>;
  repoCount: number;
}

/**
 * GET /api/developers/summary — `github:read` (same scope as /api/developers) —
 * per-login rollup of the precomputed `developer_stats` table (one row per
 * login×repo) plus org totals. An empty table signals the stats sync hasn't
 * run yet, surfaced as `stale: true`.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "github:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await db.select().from(developerStats);
  if (rows.length === 0) {
    return NextResponse.json({ developers: [], stale: true });
  }

  const byLogin = new Map<
    string,
    Omit<DeveloperRollup, "topLanguages" | "repoCount"> & {
      languages: Map<string, number>;
      repos: Set<string>;
    }
  >();
  const orgRepos = new Set<string>();
  let computedAt: Date | null = null;

  for (const r of rows) {
    let dev = byLogin.get(r.login);
    if (!dev) {
      dev = {
        login: r.login,
        team: null,
        totalLoc: 0,
        additions: 0,
        deletions: 0,
        commits: 0,
        languages: new Map(),
        repos: new Set(),
      };
      byLogin.set(r.login, dev);
    }
    dev.team ??= r.team;
    dev.totalLoc += r.loc;
    dev.additions += r.additions;
    dev.deletions += r.deletions;
    dev.commits += r.commits;
    if (r.repo) {
      dev.repos.add(r.repo);
      orgRepos.add(r.repo);
    }
    for (const [lang, loc] of Object.entries(r.languages ?? {})) {
      dev.languages.set(lang, (dev.languages.get(lang) ?? 0) + loc);
    }
    if (!computedAt || r.computedAt > computedAt) computedAt = r.computedAt;
  }

  const developers: DeveloperRollup[] = [...byLogin.values()]
    .map(({ languages, repos, ...dev }) => ({
      ...dev,
      topLanguages: [...languages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([language, loc]) => ({ language, loc })),
      repoCount: repos.size,
    }))
    .sort((a, b) => b.totalLoc - a.totalLoc);

  const totals = {
    developerCount: developers.length,
    repoCount: orgRepos.size,
    totalLoc: developers.reduce((n, d) => n + d.totalLoc, 0),
    additions: developers.reduce((n, d) => n + d.additions, 0),
    deletions: developers.reduce((n, d) => n + d.deletions, 0),
    commits: developers.reduce((n, d) => n + d.commits, 0),
  };

  return NextResponse.json({ developers, totals, stale: false, computedAt });
}
