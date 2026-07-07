import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { createGithubAdapter } from "@/lib/integrations/github";
import { runSync } from "@/lib/integrations/sync/orchestrator";
import type { IntegrationAdapter } from "@/lib/integrations/types";

/**
 * Standalone real-GitHub discovery runner: `tsx db/github-sync-cli.ts`.
 *
 * Run it with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npx tsx db/github-sync-cli.ts
 *
 * Creates its own single-connection Drizzle client (like db/sync-cli.ts) so it
 * never imports the `server-only` `@/db` module, then builds the GitHub org
 * adapter and runs a READ-ONLY enumeration → Postgres (integration_accounts,
 * integration_sync, resources, resource_snapshots, resource_edges).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "postgres://truesight:truesight@localhost:5433/truesight";
  const owner =
    process.env.GITHUB_OWNER?.trim() || process.env.GITHUB_ORG?.trim() || "mystery01092000";

  if (!process.env.GITHUB_PAT?.trim()) {
    throw new Error("No GITHUB_PAT in env. Did you `source .env.local`?");
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  const adapters: IntegrationAdapter[] = [
    createGithubAdapter({ owner, label: `GitHub · ${owner}` }),
  ];

  console.log(`[github-sync] enumerating owner ${owner} (org or personal account) ...`);

  for (const a of adapters) {
    const label = (a as { label?: string }).label ?? a.instanceId;
    const h = await a.healthCheck();
    console.log(`[github-sync] health ${label}: ok=${h.ok} ${h.detail ?? ""}`);
  }

  try {
    const summaries = await runSync({ adapters, trigger: "cli", db });
    for (const s of summaries) {
      console.log(`\n=== ${s.label} (${s.account}) — status=${s.status} ===`);
      console.log(`  resources: ${s.resourceCount}   edges: ${s.edgeCount}`);
      console.log(`  byKind: ${JSON.stringify(s.byKind)}`);
      if (s.errors.length > 0) {
        console.log(`  errors (${s.errors.length}):`);
        for (const e of s.errors.slice(0, 20)) {
          console.log(`    - [${e.scope}] ${e.code}: ${e.message}`);
        }
        if (s.errors.length > 20) console.log(`    … +${s.errors.length - 20} more`);
      }
    }
    const total = summaries.reduce((n, s) => n + s.resourceCount, 0);
    const edges = summaries.reduce((n, s) => n + s.edgeCount, 0);
    console.log(`\n[github-sync] DONE — ${total} resources, ${edges} edges across ${summaries.length} owner(s).`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[github-sync] failed:", err);
    process.exit(1);
  });
