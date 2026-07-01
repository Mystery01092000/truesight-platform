import pLimit from "p-limit";

import type { EdgeKind, ResourceStatus } from "@/lib/taxonomy";
import type {
  AdapterError,
  AdapterHealth,
  CloudResource,
  DiscoveryResult,
  GraphEdge,
  IntegrationAdapter,
} from "@/lib/integrations/types";
import { makeUrn } from "@/lib/integrations/types";

import { createGithubClient, type GithubClient } from "./client";

/* -------------------------------------------------------------------------- */
/* Config + public shape                                                      */
/* -------------------------------------------------------------------------- */

export interface GithubAdapterConfig {
  /** Org login to enumerate. Defaults to `GITHUB_ORG` / `centricitywealthtech`. */
  org?: string;
  /** Friendly display name persisted onto the integration account. */
  label?: string;
  /** Explicit PAT (else resolved from `GITHUB_PAT`). */
  token?: string;
  /** Concurrency for per-team / per-repo fan-out. */
  concurrency?: number;
}

/**
 * Like the AWS adapter, we surface `org`/`label` so the sync orchestrator can
 * key `integration_accounts` and label the run without re-deriving them.
 */
export interface GithubIntegrationAdapter extends IntegrationAdapter {
  readonly org: string;
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Narrow row shapes (only the fields we map) — keeps us off Octokit's deep    */
/* endpoint types while staying strict about what we read.                     */
/* -------------------------------------------------------------------------- */

interface TeamRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  privacy?: string;
  permission?: string;
  notification_setting?: string;
  html_url: string;
  parent?: { slug: string } | null;
}
interface UserRow {
  id: number;
  login: string;
  html_url: string;
  avatar_url: string;
  type: string;
  site_admin: boolean;
}
interface RepoRow {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count?: number;
  forks_count?: number;
  watchers_count?: number;
  open_issues_count?: number;
  size?: number;
  private: boolean;
  visibility?: string;
  archived: boolean;
  fork: boolean;
  default_branch?: string;
  html_url: string;
  pushed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  topics?: string[];
}
interface ContributorRow {
  id?: number;
  login?: string;
  contributions?: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function urnFor(org: string, kind: "team" | "member" | "repo", id: string | number): string {
  return makeUrn({ provider: "github", account: org, region: null, service: kind, nativeId: String(id) });
}

function edge(source: string, target: string, kind: EdgeKind): GraphEdge {
  return { id: `${source}=>${target}:${kind}`, source, target, kind };
}

function toAdapterError(scope: string, err: unknown): AdapterError {
  const e = err as { status?: number; message?: string; name?: string };
  const status = e?.status;
  return {
    provider: "github",
    scope,
    code: status ? `HTTP ${status}` : e?.name ?? "Error",
    message: e?.message ?? String(err),
    retryable: status ? status >= 500 || status === 429 || status === 403 : false,
  };
}

/** ISO string or null (Octokit sometimes yields empty strings). */
function iso(v: string | null | undefined): string | null {
  return v ? new Date(v).toISOString() : null;
}

/* -------------------------------------------------------------------------- */
/* Adapter                                                                     */
/* -------------------------------------------------------------------------- */

export function createGithubAdapter(cfg: GithubAdapterConfig = {}): GithubIntegrationAdapter {
  const client: GithubClient = createGithubClient({ org: cfg.org, token: cfg.token });
  const org = client.org;
  const label = cfg.label ?? `GitHub · ${org}`;
  const limit = pLimit(cfg.concurrency ?? 8);

  return {
    provider: "github",
    instanceId: org,
    org,
    label,

    async healthCheck(): Promise<AdapterHealth> {
      try {
        const me = await client.rest.users.getAuthenticated();
        const o = await client.rest.orgs.get({ org });
        return {
          provider: "github",
          instanceId: org,
          ok: true,
          detail: `viewer=${me.data.login} org=${o.data.login} repos=${o.data.public_repos + (o.data.total_private_repos ?? 0)}`,
        };
      } catch (err) {
        const e = toAdapterError("users:getAuthenticated", err);
        return { provider: "github", instanceId: org, ok: false, detail: `${e.code}: ${e.message}` };
      }
    },

    async discover(): Promise<DiscoveryResult> {
      const errors: AdapterError[] = [];
      const now = new Date().toISOString();

      // 1. Top-level enumeration (teams, org members, repos) — isolated.
      const [teamsR, membersR, reposR] = await Promise.allSettled([
        client.paginate(client.rest.teams.list, { org, per_page: 100 }) as Promise<TeamRow[]>,
        client.paginate(client.rest.orgs.listMembers, { org, per_page: 100 }) as Promise<UserRow[]>,
        client.paginate(client.rest.repos.listForOrg, {
          org,
          per_page: 100,
          type: "all",
          sort: "pushed",
        }) as Promise<RepoRow[]>,
      ]);

      const teams = teamsR.status === "fulfilled" ? teamsR.value : [];
      if (teamsR.status === "rejected") errors.push(toAdapterError("teams:list", teamsR.reason));
      const orgMembers = membersR.status === "fulfilled" ? membersR.value : [];
      if (membersR.status === "rejected") errors.push(toAdapterError("orgs:listMembers", membersR.reason));
      const repos = reposR.status === "fulfilled" ? reposR.value : [];
      if (reposR.status === "rejected") errors.push(toAdapterError("repos:listForOrg", reposR.reason));

      // Member registry keyed by id (union of org members + team members).
      const members = new Map<number, UserRow>();
      for (const m of orgMembers) if (m?.id) members.set(m.id, m);

      // 2. Per-team fan-out: members + repos (each isolated).
      const teamMembers = new Map<number, number[]>(); // teamId -> memberIds
      const teamRepos = new Map<number, number[]>(); // teamId -> repoIds
      const repoById = new Map<number, RepoRow>();
      for (const r of repos) if (r?.id) repoById.set(r.id, r);

      await Promise.allSettled(
        teams.flatMap((t) => [
          limit(async () => {
            try {
              const rows = (await client.paginate(client.rest.teams.listMembersInOrg, {
                org,
                team_slug: t.slug,
                per_page: 100,
              })) as UserRow[];
              teamMembers.set(
                t.id,
                rows.map((m) => {
                  if (m?.id && !members.has(m.id)) members.set(m.id, m);
                  return m.id;
                }),
              );
            } catch (err) {
              errors.push(toAdapterError(`teams:members:${t.slug}`, err));
            }
          }),
          limit(async () => {
            try {
              const rows = (await client.paginate(client.rest.teams.listReposInOrg, {
                org,
                team_slug: t.slug,
                per_page: 100,
              })) as RepoRow[];
              teamRepos.set(
                t.id,
                rows.map((r) => {
                  if (r?.id && !repoById.has(r.id)) repoById.set(r.id, r);
                  return r.id;
                }),
              );
            } catch (err) {
              errors.push(toAdapterError(`teams:repos:${t.slug}`, err));
            }
          }),
        ]),
      );

      // 3. Per-repo contributor insight (first page = top contributors by count).
      //    Aggregate into per-member totals for the "top contributors" insight.
      const repoContribs = new Map<number, ContributorRow[]>();
      const memberContrib = new Map<number, { total: number; repos: { repo: string; contributions: number }[] }>();

      await Promise.allSettled(
        [...repoById.values()].map((r) =>
          limit(async () => {
            try {
              const resp = await client.rest.repos.listContributors({
                owner: org,
                repo: r.name,
                per_page: 100,
                anon: "0",
              });
              // Empty repos (no commits) return 204 with a non-array body.
              const rows: ContributorRow[] = Array.isArray(resp.data) ? resp.data : [];
              repoContribs.set(r.id, rows);
              for (const c of rows) {
                if (!c?.id) continue;
                const n = c.contributions ?? 0;
                const cur = memberContrib.get(c.id) ?? { total: 0, repos: [] };
                cur.total += n;
                cur.repos.push({ repo: r.name, contributions: n });
                memberContrib.set(c.id, cur);
              }
            } catch (err) {
              errors.push(toAdapterError(`repos:contributors:${r.name}`, err));
            }
          }),
        ),
      );

      // 4. Reverse index: memberId -> team slugs (for member attributes).
      const memberTeams = new Map<number, string[]>();
      for (const t of teams) {
        for (const mid of teamMembers.get(t.id) ?? []) {
          const arr = memberTeams.get(mid) ?? [];
          arr.push(t.slug);
          memberTeams.set(mid, arr);
        }
      }

      /* ---------------------------------------------------------------- */
      /* Build canonical resources                                        */
      /* ---------------------------------------------------------------- */
      const resources: CloudResource[] = [];
      const edges: GraphEdge[] = [];

      // Teams
      for (const t of teams) {
        resources.push({
          urn: urnFor(org, "team", t.id),
          provider: "github",
          account: org,
          region: null,
          service: "team",
          kind: "team",
          nativeType: "github_team",
          name: t.name || t.slug,
          nativeId: String(t.id),
          status: "healthy",
          tags: {},
          attributes: {
            slug: t.slug,
            description: t.description,
            privacy: t.privacy ?? null,
            permission: t.permission ?? null,
            notificationSetting: t.notification_setting ?? null,
            parentSlug: t.parent?.slug ?? null,
            htmlUrl: t.html_url,
            memberCount: (teamMembers.get(t.id) ?? []).length,
            repoCount: (teamRepos.get(t.id) ?? []).length,
          },
          relationships: [],
          source: "live",
          discoveredAt: now,
        });
      }

      // Members
      for (const m of members.values()) {
        const ci = memberContrib.get(m.id);
        const topRepos = (ci?.repos ?? [])
          .sort((a, b) => b.contributions - a.contributions)
          .slice(0, 5);
        const teamsOf = memberTeams.get(m.id) ?? [];
        resources.push({
          urn: urnFor(org, "member", m.id),
          provider: "github",
          account: org,
          region: null,
          service: "member",
          kind: "member",
          nativeType: "github_member",
          name: m.login,
          nativeId: String(m.id),
          status: "healthy",
          tags: {},
          attributes: {
            login: m.login,
            htmlUrl: m.html_url,
            avatarUrl: m.avatar_url,
            type: m.type,
            siteAdmin: m.site_admin,
            teams: teamsOf,
            teamCount: teamsOf.length,
            contributions: ci?.total ?? 0,
            repoContributedCount: ci?.repos.length ?? 0,
            topRepos,
          },
          relationships: [],
          source: "live",
          discoveredAt: now,
        });
      }

      // Repos
      for (const r of repoById.values()) {
        const contribs = (repoContribs.get(r.id) ?? [])
          .filter((c) => c.login)
          .sort((a, b) => (b.contributions ?? 0) - (a.contributions ?? 0));
        const totalContributions = contribs.reduce((n, c) => n + (c.contributions ?? 0), 0);
        const status: ResourceStatus = r.archived ? "stopped" : "healthy";
        resources.push({
          urn: urnFor(org, "repo", r.id),
          provider: "github",
          account: org,
          region: null,
          service: "repo",
          kind: "repo",
          nativeType: "github_repository",
          name: r.name,
          nativeId: String(r.id),
          status,
          tags: {},
          attributes: {
            fullName: r.full_name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count ?? 0,
            forks: r.forks_count ?? 0,
            watchers: r.watchers_count ?? 0,
            openIssues: r.open_issues_count ?? 0,
            sizeKb: r.size ?? 0,
            private: r.private,
            visibility: r.visibility ?? (r.private ? "private" : "public"),
            archived: r.archived,
            isFork: r.fork,
            defaultBranch: r.default_branch ?? null,
            htmlUrl: r.html_url,
            topics: r.topics ?? [],
            pushedAt: iso(r.pushed_at),
            updatedAt: iso(r.updated_at),
            createdAt: iso(r.created_at),
            contributorCount: contribs.length,
            totalContributions,
            topContributors: contribs
              .slice(0, 5)
              .map((c) => ({ login: c.login, contributions: c.contributions ?? 0 })),
          },
          relationships: [],
          source: "live",
          discoveredAt: now,
        });
      }

      /* ---------------------------------------------------------------- */
      /* Build edges (truthful containment)                               */
      /*   team contains member  (team membership)                        */
      /*   team contains repo    (team repository access)                 */
      /* ---------------------------------------------------------------- */
      for (const t of teams) {
        const tUrn = urnFor(org, "team", t.id);
        for (const mid of teamMembers.get(t.id) ?? []) {
          if (mid) edges.push(edge(tUrn, urnFor(org, "member", mid), "contains"));
        }
        for (const rid of teamRepos.get(t.id) ?? []) {
          if (rid) edges.push(edge(tUrn, urnFor(org, "repo", rid), "contains"));
        }
      }

      return {
        resources,
        edges,
        partial: errors.length > 0,
        errors,
      };
    },
  };
}
