import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { developerStats } from "@/db/schema";

/**
 * Developer Portal data access — the same `developer_stats` reads the
 * /api/developers/summary route serves, exposed as server-component helpers so
 * the pages render without a client fetch hop. One row per (login, repo) is
 * rolled up into per-developer aggregates; an empty table means the LOC engine
 * hasn't materialized stats yet and is surfaced as `stale: true`.
 */

export type LanguageSlice = { language: string; loc: number };

export type DeveloperRollup = {
  login: string;
  team: string | null;
  totalLoc: number;
  additions: number;
  deletions: number;
  commits: number;
  topLanguages: LanguageSlice[];
  repoCount: number;
};

export type DeveloperRollupResult = {
  developers: DeveloperRollup[];
  totals: {
    developerCount: number;
    repoCount: number;
    totalLoc: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  stale: boolean;
  computedAt: string | null;
};

const EMPTY_TOTALS: DeveloperRollupResult["totals"] = {
  developerCount: 0,
  repoCount: 0,
  totalLoc: 0,
  additions: 0,
  deletions: 0,
  commits: 0,
};

/** Org-wide per-developer rollup (mirrors GET /api/developers/summary). */
export async function getDeveloperRollups(): Promise<DeveloperRollupResult> {
  const rows = await db.select().from(developerStats);
  if (rows.length === 0) {
    return { developers: [], totals: EMPTY_TOTALS, stale: true, computedAt: null };
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
    .sort((a, b) => b.totalLoc - a.totalLoc || a.login.localeCompare(b.login));

  return {
    developers,
    totals: {
      developerCount: developers.length,
      repoCount: orgRepos.size,
      totalLoc: developers.reduce((n, d) => n + d.totalLoc, 0),
      additions: developers.reduce((n, d) => n + d.additions, 0),
      deletions: developers.reduce((n, d) => n + d.deletions, 0),
      commits: developers.reduce((n, d) => n + d.commits, 0),
    },
    stale: false,
    computedAt: computedAt ? computedAt.toISOString() : null,
  };
}

export type DeveloperRepoStat = {
  /** Full name as stored ("owner/name"). */
  repo: string;
  /** Short repo name (segment after the slash). */
  name: string;
  loc: number;
  additions: number;
  deletions: number;
  commits: number;
};

export type DeveloperProfile = {
  login: string;
  team: string | null;
  totalLoc: number;
  additions: number;
  deletions: number;
  commits: number;
  repoCount: number;
  /** Byte-weighted language mix across every repo this login touched. */
  languages: LanguageSlice[];
  /** Per-repo contribution rows, sorted by net LOC descending. */
  repos: DeveloperRepoStat[];
  computedAt: string | null;
};

/** Per-login profile from `developer_stats`; null when no rows exist yet. */
export async function getDeveloperProfile(login: string): Promise<DeveloperProfile | null> {
  const rows = await db
    .select()
    .from(developerStats)
    .where(eq(developerStats.login, login));
  if (rows.length === 0) return null;

  let team: string | null = null;
  let totalLoc = 0;
  let additions = 0;
  let deletions = 0;
  let commits = 0;
  let computedAt: Date | null = null;
  const langs = new Map<string, number>();
  const repos: DeveloperRepoStat[] = [];

  for (const r of rows) {
    team ??= r.team;
    totalLoc += r.loc;
    additions += r.additions;
    deletions += r.deletions;
    commits += r.commits;
    if (!computedAt || r.computedAt > computedAt) computedAt = r.computedAt;
    for (const [lang, loc] of Object.entries(r.languages ?? {})) {
      langs.set(lang, (langs.get(lang) ?? 0) + loc);
    }
    if (r.repo) {
      repos.push({
        repo: r.repo,
        name: r.repo.split("/").pop() ?? r.repo,
        loc: r.loc,
        additions: r.additions,
        deletions: r.deletions,
        commits: r.commits,
      });
    }
  }

  repos.sort((a, b) => b.loc - a.loc || b.commits - a.commits || a.name.localeCompare(b.name));

  return {
    login: rows[0]!.login,
    team,
    totalLoc,
    additions,
    deletions,
    commits,
    repoCount: repos.length,
    languages: [...langs.entries()]
      .map(([language, loc]) => ({ language, loc }))
      .sort((a, b) => b.loc - a.loc),
    repos,
    computedAt: computedAt ? computedAt.toISOString() : null,
  };
}
