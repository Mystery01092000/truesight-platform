import "server-only";

import { and, asc, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { resources, resourceEdges, integrationAccounts, integrationSync } from "@/db/schema";

/**
 * GitHub org-insights data access. Reads the materialized `resources` +
 * `resource_edges` tables (real discovered org graph — never mocked) and shapes
 * them into serializable view-models + rollups for the insights UI. Kept free
 * of Drizzle row types so everything crosses the RSC → client boundary cleanly.
 */

/* -------------------------------- view-models ----------------------------- */

export type ContribRef = { login: string; contributions: number };
export type RepoRef = { repo: string; contributions: number };

export type GithubMemberView = {
  urn: string;
  login: string;
  htmlUrl: string;
  avatarUrl: string;
  siteAdmin: boolean;
  teams: string[];
  teamCount: number;
  contributions: number;
  repoContributedCount: number;
  topRepos: RepoRef[];
};

export type GithubRepoView = {
  urn: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  archived: boolean;
  isFork: boolean;
  visibility: string;
  pushedAt: string | null;
  htmlUrl: string;
  contributorCount: number;
  totalContributions: number;
  topContributors: ContribRef[];
};

export type GithubTeamView = {
  urn: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: string | null;
  permission: string | null;
  memberCount: number;
  repoCount: number;
  htmlUrl: string;
  members: GithubMemberView[];
  repos: GithubRepoView[];
};

export type LanguageStat = { language: string; count: number };

export type GithubInsights = {
  org: string;
  counts: {
    teams: number;
    members: number;
    repos: number;
    edges: number;
    contributions: number;
  };
  teams: GithubTeamView[];
  members: GithubMemberView[];
  repos: GithubRepoView[];
  topContributors: GithubMemberView[];
  topRepos: GithubRepoView[];
  languages: LanguageStat[];
  lastSync: { status: string; startedAt: string | null } | null;
};

/* --------------------------- attribute coercion --------------------------- */

type Attrs = Record<string, unknown>;
const str = (a: Attrs, k: string, d = ""): string => (typeof a[k] === "string" ? (a[k] as string) : d);
const strOrNull = (a: Attrs, k: string): string | null => (typeof a[k] === "string" ? (a[k] as string) : null);
const num = (a: Attrs, k: string): number => (typeof a[k] === "number" ? (a[k] as number) : 0);
const bool = (a: Attrs, k: string): boolean => a[k] === true;
const strArr = (a: Attrs, k: string): string[] =>
  Array.isArray(a[k]) ? (a[k] as unknown[]).filter((v): v is string => typeof v === "string") : [];
const contribRefs = (a: Attrs, k: string): ContribRef[] =>
  Array.isArray(a[k])
    ? (a[k] as unknown[])
        .map((v) => v as Record<string, unknown>)
        .filter((v) => typeof v?.login === "string")
        .map((v) => ({ login: v.login as string, contributions: typeof v.contributions === "number" ? v.contributions : 0 }))
    : [];
const repoRefs = (a: Attrs, k: string): RepoRef[] =>
  Array.isArray(a[k])
    ? (a[k] as unknown[])
        .map((v) => v as Record<string, unknown>)
        .filter((v) => typeof v?.repo === "string")
        .map((v) => ({ repo: v.repo as string, contributions: typeof v.contributions === "number" ? v.contributions : 0 }))
    : [];

function toMember(urn: string, name: string, a: Attrs): GithubMemberView {
  return {
    urn,
    login: str(a, "login", name),
    htmlUrl: str(a, "htmlUrl"),
    avatarUrl: str(a, "avatarUrl"),
    siteAdmin: bool(a, "siteAdmin"),
    teams: strArr(a, "teams"),
    teamCount: num(a, "teamCount"),
    contributions: num(a, "contributions"),
    repoContributedCount: num(a, "repoContributedCount"),
    topRepos: repoRefs(a, "topRepos"),
  };
}

function toRepo(urn: string, name: string, a: Attrs): GithubRepoView {
  return {
    urn,
    name,
    fullName: str(a, "fullName", name),
    description: strOrNull(a, "description"),
    language: strOrNull(a, "language"),
    stars: num(a, "stars"),
    forks: num(a, "forks"),
    archived: bool(a, "archived"),
    isFork: bool(a, "isFork"),
    visibility: str(a, "visibility", "private"),
    pushedAt: strOrNull(a, "pushedAt"),
    htmlUrl: str(a, "htmlUrl"),
    contributorCount: num(a, "contributorCount"),
    totalContributions: num(a, "totalContributions"),
    topContributors: contribRefs(a, "topContributors"),
  };
}

function toTeam(urn: string, name: string, a: Attrs): GithubTeamView {
  return {
    urn,
    name,
    slug: str(a, "slug", name),
    description: strOrNull(a, "description"),
    privacy: strOrNull(a, "privacy"),
    permission: strOrNull(a, "permission"),
    memberCount: num(a, "memberCount"),
    repoCount: num(a, "repoCount"),
    htmlUrl: str(a, "htmlUrl"),
    members: [],
    repos: [],
  };
}

/** The `service` segment of a canonical URN (`github:org:global:<service>:<id>`). */
function urnKind(urn: string): string {
  return urn.split(":")[3] ?? "";
}

/* -------------------------------- loader ---------------------------------- */

/** Read the full GitHub org graph from the KB and roll it up into insights. */
export async function getGithubInsights(): Promise<GithubInsights | null> {
  const rows = await db
    .select({
      urn: resources.urn,
      account: resources.account,
      name: resources.name,
      type: resources.type,
      attributes: resources.attributes,
    })
    .from(resources)
    .where(and(eq(resources.provider, "github"), eq(resources.present, true)))
    .orderBy(asc(resources.name));

  if (rows.length === 0) return null;

  const org = rows.find((r) => r.account)?.account ?? "centricitywealthtech";

  const teamMap = new Map<string, GithubTeamView>();
  const memberMap = new Map<string, GithubMemberView>();
  const repoMap = new Map<string, GithubRepoView>();

  for (const r of rows) {
    const a = (r.attributes ?? {}) as Attrs;
    const name = r.name ?? r.urn;
    if (r.type === "team") teamMap.set(r.urn, toTeam(r.urn, name, a));
    else if (r.type === "member") memberMap.set(r.urn, toMember(r.urn, name, a));
    else if (r.type === "repo") repoMap.set(r.urn, toRepo(r.urn, name, a));
  }

  // Attach members + repos to their teams via `contains` edges.
  const edges = await db
    .select({ source: resourceEdges.sourceUrn, target: resourceEdges.targetUrn })
    .from(resourceEdges)
    .where(and(eq(resourceEdges.kind, "contains"), like(resourceEdges.sourceUrn, "github:%")));

  for (const e of edges) {
    const team = teamMap.get(e.source);
    if (!team) continue;
    const kind = urnKind(e.target);
    if (kind === "member") {
      const m = memberMap.get(e.target);
      if (m) team.members.push(m);
    } else if (kind === "repo") {
      const r = repoMap.get(e.target);
      if (r) team.repos.push(r);
    }
  }

  // Sort within teams (members by contributions, repos by activity).
  for (const t of teamMap.values()) {
    t.members.sort((a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login));
    t.repos.sort((a, b) => b.totalContributions - a.totalContributions || a.name.localeCompare(b.name));
  }

  const teams = [...teamMap.values()].sort(
    (a, b) => b.repoCount - a.repoCount || b.memberCount - a.memberCount || a.name.localeCompare(b.name),
  );
  const members = [...memberMap.values()];
  const repos = [...repoMap.values()];

  const topContributors = [...members]
    .filter((m) => m.contributions > 0)
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 8);

  const topRepos = [...repos]
    .sort((a, b) => b.totalContributions - a.totalContributions || b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, 8);

  const langTally = new Map<string, number>();
  for (const r of repos) {
    if (!r.language) continue;
    langTally.set(r.language, (langTally.get(r.language) ?? 0) + 1);
  }
  const languages: LanguageStat[] = [...langTally.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

  const contributions = members.reduce((n, m) => n + m.contributions, 0);

  // Last sync for the GitHub account.
  let lastSync: GithubInsights["lastSync"] = null;
  const [acct] = await db
    .select({ id: integrationAccounts.id })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.provider, "github"))
    .limit(1);
  if (acct) {
    const [s] = await db
      .select({ status: integrationSync.status, startedAt: integrationSync.startedAt })
      .from(integrationSync)
      .where(eq(integrationSync.accountId, acct.id))
      .orderBy(desc(integrationSync.startedAt))
      .limit(1);
    if (s) lastSync = { status: s.status, startedAt: s.startedAt ? s.startedAt.toISOString() : null };
  }

  return {
    org,
    counts: { teams: teams.length, members: members.length, repos: repos.length, edges: edges.length, contributions },
    teams,
    members,
    repos,
    topContributors,
    topRepos,
    languages,
    lastSync,
  };
}
