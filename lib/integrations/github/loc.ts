import "server-only";

import pLimit from "p-limit";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { developerStats, resources, type NewDeveloperStat } from "@/db/schema";
import { cacheable, invalidatePrefix } from "@/lib/cache";

import { createGithubClient } from "./client";

/**
 * GitHub LOC analysis engine. Reads the org's discovered repositories from the
 * KB (`resources`, kind=repo) and computes lines-of-code metrics from GitHub's
 * statistics endpoints (code-frequency + contributor activity). The stats API
 * is asynchronous + rate-limited, so every call is memoized behind `cacheable`
 * (60min TTL) and every failure degrades to a zero/empty result rather than
 * throwing — a single rate-limited repo never blanks the whole org summary.
 */

const CACHE_TTL_SECONDS = 60 * 60; // 60 minutes
const COMPUTE_RETRIES = 3;
const COMPUTE_BACKOFF_MS = 1500;
const CONCURRENCY = 6;
const TREND_WEEKS = 26;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/* --------------------------------- types --------------------------------- */

export type WeeklyPoint = { ts: number; net: number };

export type RepoLOCAnalysis = {
  owner: string;
  repo: string;
  additions: number;
  deletions: number;
  netLOC: number;
  recentLOCVelocity: number;
  weeks: number;
  weekly: WeeklyPoint[];
  ok: boolean;
};

export type ContributorStat = {
  login: string;
  htmlUrl: string;
  avatarUrl: string;
  commits: number;
  additions: number;
  deletions: number;
  netLOC: number;
};

export type ContributorStatResult = {
  owner: string;
  repo: string;
  contributors: ContributorStat[];
  commitsLast30d: number;
  ok: boolean;
};

export type RepoLOCBreakdown = {
  name: string;
  fullName: string;
  owner: string;
  language: string | null;
  additions: number;
  deletions: number;
  netLOC: number;
  contributorCount: number;
  trend: number[];
};

export type ContributorLeader = {
  login: string;
  htmlUrl: string;
  avatarUrl: string;
  commits: number;
  additions: number;
  deletions: number;
  netLOC: number;
};

export type LanguageShare = {
  language: string;
  bytes: number;
};

export type OrgLOCSummary = {
  org: string;
  totalLOC: number;
  totalAdditions: number;
  totalDeletions: number;
  repoCount: number;
  contributorCount: number;
  commitsThisMonth: number;
  repos: RepoLOCBreakdown[];
  topContributors: ContributorLeader[];
  languages: LanguageShare[];
  locTrend: number[];
  partial: boolean;
  generatedAt: string;
};

/* ------------------------------- internals -------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Agent/bot identities excluded from developer stats (org policy: human
// contributors only). Matches GitHub Apps ("[bot]") and known agent logins.
const AGENT_LOGIN_RE = /\[bot\]$|^(claude|devin|copilot|dependabot|renovate)(-|$)/i;
const isAgentLogin = (login: string): boolean => AGENT_LOGIN_RE.test(login);

type AnyResponse = { status: number; data: unknown };

/** GitHub computes stats asynchronously — a first hit often returns 202 with an
 *  empty body. Wait briefly and re-request until a 200/204 lands. */
async function withComputeRetry<R extends AnyResponse>(call: () => Promise<R>): Promise<R> {
  let resp = await call();
  for (let attempt = 0; attempt < COMPUTE_RETRIES && resp.status === 202; attempt++) {
    await sleep(COMPUTE_BACKOFF_MS * (attempt + 1));
    resp = await call();
  }
  return resp;
}

type Attrs = Record<string, unknown>;
const strOr = (a: Attrs, k: string, d: string): string =>
  typeof a[k] === "string" ? (a[k] as string) : d;
const strOrNull = (a: Attrs, k: string): string | null =>
  typeof a[k] === "string" ? (a[k] as string) : null;

/** Owner segment of a `owner/name` full name (falls back to the org account). */
function ownerOf(fullName: string | null, account: string | null): string {
  if (fullName && fullName.includes("/")) return fullName.split("/")[0]!;
  return account ?? "arcane";
}

/** Discovered GitHub repositories from the KB (kind=repo, present). */
async function readDiscoveredRepos(): Promise<
  { name: string; owner: string; fullName: string; language: string | null; urn: string }[]
> {
  const rows = await db
    .select({
      urn: resources.urn,
      name: resources.name,
      account: resources.account,
      attributes: resources.attributes,
    })
    .from(resources)
    .where(
      and(
        eq(resources.provider, "github"),
        eq(resources.type, "repo"),
        eq(resources.present, true),
      ),
    )
    .orderBy(resources.name);

  return rows.map((r) => {
    const a = (r.attributes ?? {}) as Attrs;
    const fullName = strOrNull(a, "fullName") ?? r.name ?? "";
    return {
      name: r.name ?? fullName,
      owner: ownerOf(fullName, r.account),
      fullName,
      language: strOrNull(a, "language"),
      urn: r.urn,
    };
  });
}

/* ------------------------------- per-repo --------------------------------- */

/** Weekly additions/deletions for a repository → total LOC + recent velocity. */
export async function analyzeRepoLOC(
  owner: string,
  repo: string,
): Promise<RepoLOCAnalysis> {
  return cacheable(`developers:loc:repo:${owner}/${repo}`, CACHE_TTL_SECONDS, async () => {
    const base: RepoLOCAnalysis = {
      owner,
      repo,
      additions: 0,
      deletions: 0,
      netLOC: 0,
      recentLOCVelocity: 0,
      weeks: 0,
      weekly: [],
      ok: false,
    };
    try {
      const client = createGithubClient({ org: owner });
      const resp = await withComputeRetry(() =>
        client.rest.repos.getCodeFrequencyStats({ owner, repo }),
      );
      const rows = Array.isArray(resp.data) ? (resp.data as number[][]) : [];
      if (rows.length === 0) return base;

      let additions = 0;
      let deletions = 0;
      const weekly: WeeklyPoint[] = [];
      for (const row of rows) {
        const ts = Number(row[0] ?? 0);
        const a = Number(row[1] ?? 0);
        const d = Math.abs(Number(row[2] ?? 0));
        additions += a;
        deletions += d;
        weekly.push({ ts, net: a - d });
      }

      const recent = weekly.slice(-4).reduce((s, w) => s + w.net, 0);
      return {
        owner,
        repo,
        additions,
        deletions,
        netLOC: additions - deletions,
        recentLOCVelocity: recent,
        weeks: rows.length,
        weekly,
        ok: true,
      };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      console.warn(
        `[github/loc] code-frequency failed for ${owner}/${repo}: ${e?.status ?? ""} ${e?.message ?? err}`,
      );
      return base;
    }
  });
}

/** Per-developer contribution activity (commits, additions, deletions). */
export async function getContributorStats(
  owner: string,
  repo: string,
): Promise<ContributorStatResult> {
  return cacheable(`developers:loc:contrib:${owner}/${repo}`, CACHE_TTL_SECONDS, async () => {
    const base: ContributorStatResult = {
      owner,
      repo,
      contributors: [],
      commitsLast30d: 0,
      ok: false,
    };
    try {
      const client = createGithubClient({ org: owner });
      const resp = await withComputeRetry(() =>
        client.rest.repos.getContributorsStats({ owner, repo }),
      );
      const rows = Array.isArray(resp.data)
        ? (resp.data as {
            author: { login: string; html_url: string; avatar_url: string } | null;
            total: number;
            weeks?: { w?: number; a?: number; d?: number; c?: number }[];
          }[])
        : [];
      if (rows.length === 0) return base;

      const monthAgo = Date.now() - MONTH_MS;
      let commitsLast30d = 0;
      const contributors: ContributorStat[] = [];

      for (const r of rows) {
        const author = r.author;
        if (!author?.login) continue;
        // Human contributors only — agent/bot identities are excluded from
        // developer stats platform-wide (org policy: no agent contributors).
        if (isAgentLogin(author.login)) continue;
        let additions = 0;
        let deletions = 0;
        for (const w of r.weeks ?? []) {
          const a = Number(w.a ?? 0);
          const d = Math.abs(Number(w.d ?? 0));
          additions += a;
          deletions += d;
          if (Number(w.w ?? 0) * 1000 >= monthAgo) commitsLast30d += Number(w.c ?? 0);
        }
        contributors.push({
          login: author.login,
          htmlUrl: author.html_url ?? "",
          avatarUrl: author.avatar_url ?? "",
          commits: r.total ?? 0,
          additions,
          deletions,
          netLOC: additions - deletions,
        });
      }

      return { owner, repo, contributors, commitsLast30d, ok: true };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      console.warn(
        `[github/loc] contributors-stats failed for ${owner}/${repo}: ${e?.status ?? ""} ${e?.message ?? err}`,
      );
      return base;
    }
  });
}

/** Byte-weighted language breakdown for a repository. */
export async function getRepoLanguages(
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  return cacheable(`developers:loc:lang:${owner}/${repo}`, CACHE_TTL_SECONDS, async () => {
    try {
      const client = createGithubClient({ org: owner });
      const resp = await client.rest.repos.listLanguages({ owner, repo });
      const data = resp.data as unknown;
      return data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, number>)
        : {};
    } catch (err) {
      const e = err as { status?: number; message?: string };
      console.warn(
        `[github/loc] languages failed for ${owner}/${repo}: ${e?.status ?? ""} ${e?.message ?? err}`,
      );
      return {};
    }
  });
}

/* ------------------------------ org summary ------------------------------- */

const EMPTY_SUMMARY: OrgLOCSummary = {
  org: "arcane",
  totalLOC: 0,
  totalAdditions: 0,
  totalDeletions: 0,
  repoCount: 0,
  contributorCount: 0,
  commitsThisMonth: 0,
  repos: [],
  topContributors: [],
  languages: [],
  locTrend: [],
  partial: false,
  generatedAt: new Date().toISOString(),
};

/** Aggregated org-wide LOC metrics across every discovered repository. */
export async function getOrgLOCSummary(): Promise<OrgLOCSummary> {
  const discovered = await readDiscoveredRepos();
  if (discovered.length === 0) return { ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() };

  const org = discovered[0]!.owner || "arcane";

  return cacheable(`developers:loc:summary:${org}`, CACHE_TTL_SECONDS, async () => {
    const limit = pLimit(CONCURRENCY);
    let partial = false;

    const perRepo = await Promise.all(
      discovered.map((r) =>
        limit(async () => {
          const [loc, contribs, langs] = await Promise.all([
            analyzeRepoLOC(r.owner, r.name),
            getContributorStats(r.owner, r.name),
            getRepoLanguages(r.owner, r.name),
          ]);
          if (!loc.ok || !contribs.ok) partial = true;
          return { meta: r, loc, contribs, langs };
        }),
      ),
    );

    let totalAdditions = 0;
    let totalDeletions = 0;
    let commitsThisMonth = 0;
    const langBytes = new Map<string, number>();
    const leaderMap = new Map<string, ContributorLeader>();
    const weeklyOrg = new Map<number, number>();

    const repoBreakdown: RepoLOCBreakdown[] = perRepo
      .map(({ meta, loc, contribs, langs }) => {
        totalAdditions += loc.additions;
        totalDeletions += loc.deletions;
        commitsThisMonth += contribs.commitsLast30d;

        for (const [lang, bytes] of Object.entries(langs)) {
          langBytes.set(lang, (langBytes.get(lang) ?? 0) + bytes);
        }

        for (const c of contribs.contributors) {
          const cur =
            leaderMap.get(c.login) ??
            {
              login: c.login,
              htmlUrl: c.htmlUrl,
              avatarUrl: c.avatarUrl,
              commits: 0,
              additions: 0,
              deletions: 0,
              netLOC: 0,
            };
          cur.commits += c.commits;
          cur.additions += c.additions;
          cur.deletions += c.deletions;
          cur.netLOC += c.netLOC;
          leaderMap.set(c.login, cur);
        }

        for (const w of loc.weekly) {
          weeklyOrg.set(w.ts, (weeklyOrg.get(w.ts) ?? 0) + w.net);
        }

        return {
          name: meta.name,
          fullName: meta.fullName || `${meta.owner}/${meta.name}`,
          owner: meta.owner,
          language: meta.language,
          additions: loc.additions,
          deletions: loc.deletions,
          netLOC: loc.netLOC,
          contributorCount: contribs.contributors.length,
          trend: loc.weekly.slice(-TREND_WEEKS).map((w) => w.net),
        };
      })
      .sort((a, b) => b.netLOC - a.netLOC || a.name.localeCompare(b.name));

    const topContributors = [...leaderMap.values()]
      .filter((c) => c.commits > 0)
      .sort((a, b) => b.commits - a.commits || b.netLOC - a.netLOC)
      .slice(0, 12);

    const languages: LanguageShare[] = [...langBytes.entries()]
      .map(([language, bytes]) => ({ language, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const locTrend = [...weeklyOrg.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-TREND_WEEKS)
      .map(([, net]) => net);

    // Materialize per-developer/per-repo rollups for sub-100ms developer reads.
    // Best-effort: a write failure degrades to stale rows, never a blank summary.
    await upsertDeveloperStats(perRepo).catch((err) =>
      console.warn(
        "[github/loc] developer_stats upsert failed:",
        (err as Error)?.message ?? err,
      ),
    );

    return {
      org,
      totalLOC: totalAdditions - totalDeletions,
      totalAdditions,
      totalDeletions,
      repoCount: discovered.length,
      contributorCount: leaderMap.size,
      commitsThisMonth,
      repos: repoBreakdown,
      topContributors,
      languages,
      locTrend,
      partial,
      generatedAt: new Date().toISOString(),
    };
  });
}

/** Bust every LOC cache (summary + per-repo) — used by the admin refresh trigger. */
export async function invalidateLOCCache(): Promise<void> {
  await invalidatePrefix("developers:loc:");
}

/* --------------------------- developer_stats rollup ----------------------- */

/** login → primary team slug, derived from discovered `member` resources whose
 *  attributes carry the team slugs the GitHub adapter resolved per member. */
async function readMemberTeams(): Promise<Map<string, string>> {
  const rows = await db
    .select({ name: resources.name, attributes: resources.attributes })
    .from(resources)
    .where(
      and(
        eq(resources.provider, "github"),
        eq(resources.type, "member"),
        eq(resources.present, true),
      ),
    );

  const out = new Map<string, string>();
  for (const r of rows) {
    const a = (r.attributes ?? {}) as Attrs;
    const login = strOrNull(a, "login") ?? r.name;
    const teams = Array.isArray(a.teams)
      ? (a.teams as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    if (login && teams[0]) out.set(login, teams[0]);
  }
  return out;
}

/** Upsert one `developer_stats` row per (login, repo) from the freshly computed
 *  per-repo contributor stats, keyed on the table's (login, repo) uniqueness. */
async function upsertDeveloperStats(
  perRepo: {
    meta: { name: string; owner: string; fullName: string };
    contribs: ContributorStatResult;
    langs: Record<string, number>;
  }[],
): Promise<void> {
  const teamOf = await readMemberTeams();
  const now = new Date();

  const rows: NewDeveloperStat[] = [];
  for (const { meta, contribs, langs } of perRepo) {
    if (!contribs.ok) continue; // never overwrite good rows with zeroed failures
    const repo = meta.fullName || `${meta.owner}/${meta.name}`;
    for (const c of contribs.contributors) {
      rows.push({
        login: c.login,
        team: teamOf.get(c.login) ?? null,
        repo,
        loc: c.netLOC,
        additions: c.additions,
        deletions: c.deletions,
        commits: c.commits,
        languages: langs,
        computedAt: now,
      });
    }
  }
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(developerStats)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [developerStats.login, developerStats.repo],
        set: {
          team: sql`excluded.team`,
          loc: sql`excluded.loc`,
          additions: sql`excluded.additions`,
          deletions: sql`excluded.deletions`,
          commits: sql`excluded.commits`,
          languages: sql`excluded.languages`,
          computedAt: sql`excluded.computed_at`,
        },
      });
  }
}
