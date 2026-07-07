import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { graphql as octokitGraphql } from "@octokit/graphql";

/**
 * GitHub client factory — a read-only Octokit REST + GraphQL pair authenticated
 * from `GITHUB_PAT`.
 *
 * The client is scoped to an *owner*: either an organization login or a
 * personal user account. The owner type is auto-detected via the API (cached
 * per client) unless forced through config / `GITHUB_OWNER_TYPE`.
 *
 * READ-ONLY by construction: this module only wires credentials + a throttled
 * transport. The adapter that consumes it must call list/get operations
 * exclusively (never create/update/delete). The throttling plugin honors
 * GitHub's primary + secondary (abuse) rate limits with bounded retries so a
 * large owner enumeration degrades into backoff rather than 403 storms.
 */

const DEFAULT_OWNER = "arcane";

/** The throttled Octokit constructor (built once — the plugin is stateless). */
const ThrottledOctokit = Octokit.plugin(throttling);

export type GithubGraphql = typeof octokitGraphql;

/** Whether the scoped owner is an organization or a personal user account. */
export type GithubOwnerType = "org" | "user";

export interface GithubClient {
  /** The owner login this client is scoped to — an org or a user account. */
  readonly owner: string;
  /** @deprecated Alias of {@link owner}, kept for existing call sites. */
  readonly org: string;
  /** Full Octokit REST client (namespaced: `rest.repos.listForOrg`, ...). */
  readonly rest: Octokit;
  /** Auto-following pagination over any list endpoint (follows `Link` headers). */
  readonly paginate: Octokit["paginate"];
  /** Authenticated GraphQL v4 client for cheaper aggregate queries. */
  readonly gql: GithubGraphql;
  /**
   * Resolve whether {@link owner} is an organization or a user account.
   * Uses the forced type when configured, else one `users.getByUsername`
   * lookup memoized for the client's lifetime.
   */
  resolveOwnerType(): Promise<GithubOwnerType>;
}

export interface GithubClientConfig {
  /** Owner login — a GitHub organization or a personal user account. */
  owner?: string;
  /** @deprecated Use {@link owner}. Honored when `owner` is unset. */
  org?: string;
  /** Force the owner type instead of auto-detecting it via the API. */
  ownerType?: GithubOwnerType;
  token?: string;
}

/** Resolve the PAT from config or the environment (never logged). */
function resolveToken(explicit?: string): string {
  const token = explicit?.trim() || process.env.GITHUB_PAT?.trim();
  if (!token) {
    throw new Error(
      "No GitHub credentials: set GITHUB_PAT in the environment (loaded from .env.local).",
    );
  }
  return token;
}

/** Owner login: config (`owner`, legacy `org`) → env (`GITHUB_OWNER`, legacy `GITHUB_ORG`). */
function resolveOwner(cfg: GithubClientConfig): string {
  return (
    cfg.owner?.trim() ||
    cfg.org?.trim() ||
    process.env.GITHUB_OWNER?.trim() ||
    process.env.GITHUB_ORG?.trim() ||
    DEFAULT_OWNER
  );
}

/** Forced owner type from config or `GITHUB_OWNER_TYPE`; undefined = auto-detect. */
function forcedOwnerType(cfg: GithubClientConfig): GithubOwnerType | undefined {
  const raw = cfg.ownerType ?? process.env.GITHUB_OWNER_TYPE?.trim().toLowerCase();
  return raw === "org" || raw === "user" ? raw : undefined;
}

/** Build a throttled, read-only GitHub client bound to one owner (org or user). */
export function createGithubClient(cfg: GithubClientConfig = {}): GithubClient {
  const token = resolveToken(cfg.token);
  const owner = resolveOwner(cfg);
  const forced = forcedOwnerType(cfg);

  const rest = new ThrottledOctokit({
    auth: token,
    userAgent: "truesight-platform/github-discovery",
    request: { retries: 2 },
    throttle: {
      // Primary rate limit: wait out the reset up to a few times.
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const o = options as { method?: string; url?: string };
        console.warn(`[github] rate limit on ${o.method} ${o.url} — retry in ${retryAfter}s`);
        return retryCount < 3;
      },
      // Secondary (abuse) limit: back off once, then give up on that request.
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const o = options as { method?: string; url?: string };
        console.warn(`[github] secondary limit on ${o.method} ${o.url} — retry in ${retryAfter}s`);
        return retryCount < 1;
      },
    },
  });

  const gql = octokitGraphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  // Memoized so repeated adapter calls cost at most one detection request.
  let ownerTypePromise: Promise<GithubOwnerType> | null = null;
  const resolveOwnerType = (): Promise<GithubOwnerType> => {
    if (forced) return Promise.resolve(forced);
    if (!ownerTypePromise) {
      ownerTypePromise = rest.users
        .getByUsername({ username: owner })
        .then((r) => (r.data.type === "Organization" ? "org" : "user"));
      // Allow a retry on the next call rather than caching the failure.
      ownerTypePromise = ownerTypePromise.catch((err: unknown) => {
        ownerTypePromise = null;
        throw err;
      });
    }
    return ownerTypePromise;
  };

  return {
    owner,
    org: owner,
    rest,
    paginate: rest.paginate.bind(rest),
    gql,
    resolveOwnerType,
  };
}
