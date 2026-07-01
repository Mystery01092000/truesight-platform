import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { graphql as octokitGraphql } from "@octokit/graphql";

/**
 * GitHub client factory — a read-only Octokit REST + GraphQL pair authenticated
 * from `GITHUB_PAT`.
 *
 * READ-ONLY by construction: this module only wires credentials + a throttled
 * transport. The adapter that consumes it must call list/get operations
 * exclusively (never create/update/delete). The throttling plugin honors
 * GitHub's primary + secondary (abuse) rate limits with bounded retries so a
 * large org enumeration degrades into backoff rather than 403 storms.
 */

const DEFAULT_ORG = "centricitywealthtech";

/** The throttled Octokit constructor (built once — the plugin is stateless). */
const ThrottledOctokit = Octokit.plugin(throttling);

export type GithubGraphql = typeof octokitGraphql;

export interface GithubClient {
  /** The org login this client is scoped to (from cfg or `GITHUB_ORG`). */
  readonly org: string;
  /** Full Octokit REST client (namespaced: `rest.repos.listForOrg`, ...). */
  readonly rest: Octokit;
  /** Auto-following pagination over any list endpoint (follows `Link` headers). */
  readonly paginate: Octokit["paginate"];
  /** Authenticated GraphQL v4 client for cheaper aggregate queries. */
  readonly gql: GithubGraphql;
}

export interface GithubClientConfig {
  org?: string;
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

/** Build a throttled, read-only GitHub client bound to one org. */
export function createGithubClient(cfg: GithubClientConfig = {}): GithubClient {
  const token = resolveToken(cfg.token);
  const org = cfg.org?.trim() || process.env.GITHUB_ORG?.trim() || DEFAULT_ORG;

  const rest = new ThrottledOctokit({
    auth: token,
    userAgent: "argus-platform/github-discovery",
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

  return {
    org,
    rest,
    paginate: rest.paginate.bind(rest),
    gql,
  };
}
