import { getOrgLOCSummary, invalidateLOCCache } from "@/lib/integrations/github/loc";
import { invalidate } from "@/lib/cache";

/**
 * Standalone developer-stats (LOC) rebuild: the CLI twin of the admin
 * refresh button (`POST /api/developers`). Busts the LOC caches, then
 * recomputes the org summary — which upserts `developer_stats` per
 * (login, repo) from the repos currently discovered in `resources`.
 *
 * Run with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npm run db:loc-refresh
 */
async function main(): Promise<void> {
  if (!process.env.GITHUB_PAT?.trim()) {
    throw new Error("No GITHUB_PAT in env. Did you `source .env.local`?");
  }
  console.log("[loc-refresh] busting LOC caches ...");
  await invalidateLOCCache();
  await invalidate("developers:summary");
  console.log("[loc-refresh] rebuilding summary (GraphQL per repo — may take a while) ...");
  const s = await getOrgLOCSummary();
  console.log(
    `[loc-refresh] DONE — repos=${s.repoCount} contributors=${s.contributorCount} totalLOC=${s.totalLOC} partial=${s.partial}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[loc-refresh] failed:", err);
    process.exit(1);
  });
