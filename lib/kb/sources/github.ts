import "server-only";

import { createGithubClient, type GithubClient } from "@/lib/integrations/github/client";
import type { KbDocumentInput } from "@/lib/kb/types";

const TEXT_EXTENSIONS = new Set([".md", ".tf", ".tfvars", ".jenkinsfile", ".dockerfile", ".yaml", ".yml"]);

const SCAN_DIRS = ["", "docs", "infra", "infrastructure", "modules", "terraform", "deploy", ".github"];

interface ContentItem {
  type: string;
  path: string;
  name: string;
  html_url?: string;
  download_url?: string | null;
}

function hasTextExtension(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function isRateLimitError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 403 || e?.status === 429 || /rate limit/i.test(e?.message ?? "");
}

/**
 * Fetch decoded text content for a single file from the GitHub API.
 */
async function fetchFileContent(
  client: GithubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | undefined> {
  try {
    const resp = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(resp.data) || typeof resp.data === "string") return undefined;

    if (resp.data.type === "file" && typeof resp.data.content === "string") {
      return Buffer.from(resp.data.content, "base64").toString("utf-8");
    }

    return undefined;
  } catch (err) {
    console.error(`[kb/github] Failed to fetch ${owner}/${repo}/${path}:`, err);
    return undefined;
  }
}

/**
 * List directory entries for a path, returning only file items with text-like extensions.
 */
async function listDirectoryFiles(
  client: GithubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<ContentItem[]> {
  try {
    const resp = await client.rest.repos.getContent({ owner, repo, path, ref });
    if (!Array.isArray(resp.data)) return [];

    return resp.data
      .filter((item) => item.type === "file" && hasTextExtension(item.name))
      .map((item) => ({
        type: item.type,
        path: item.path,
        name: item.name,
        html_url: item.html_url,
        download_url: item.download_url,
      })) as ContentItem[];
  } catch (err) {
    if (isRateLimitError(err)) throw err;
    console.error(`[kb/github] Failed to list ${owner}/${repo}/${path}:`, err);
    return [];
  }
}

/**
 * Generate KB documents from markdown/terraform files in the configured GitHub org.
 *
 * Scans root-level files plus common infrastructure directories (docs/, infra/,
 * infrastructure/, modules/, terraform/, deploy/, .github/) to surface IaC
 * material without deep traversal.
 *
 * READ-ONLY: only list/get content operations are used.
 */
export async function listGithubDocuments(): Promise<KbDocumentInput[]> {
  const client = createGithubClient();
  const org = client.org;
  const documents: KbDocumentInput[] = [];

  try {
    const repos = await client.paginate(client.rest.repos.listForOrg, {
      org,
      type: "all",
      per_page: 100,
    });

    for (const repo of repos) {
      const repoName = repo.name;
      const defaultBranch = repo.default_branch ?? "main";

      try {
        const files: ContentItem[] = [];
        for (const dir of SCAN_DIRS) {
          const dirFiles = await listDirectoryFiles(client, org, repoName, dir, defaultBranch);
          files.push(...dirFiles);
        }

        for (const file of files) {
          const content = await fetchFileContent(client, org, repoName, file.path, defaultBranch);
          if (content === undefined) continue;

          documents.push({
            source: "github",
            externalId: `${org}/${repoName}/${file.path}`,
            title: file.path,
            url: file.html_url,
            content,
            metadata: {
              org,
              repo: repoName,
              branch: defaultBranch,
              path: file.path,
            },
          });
        }
      } catch (err) {
        if (isRateLimitError(err)) {
          console.warn(`[kb/github] Rate limited while scanning ${org}/${repoName}; returning partial results.`);
          return documents;
        }
        console.error(`[kb/github] Skipped ${org}/${repoName}:`, err);
      }
    }

    return documents;
  } catch (err) {
    if (isRateLimitError(err)) {
      console.warn("[kb/github] Rate limited while listing repositories; returning partial results.");
      return documents;
    }
    console.error("[kb/github] Failed to list GitHub documents:", err);
    return [];
  }
}
