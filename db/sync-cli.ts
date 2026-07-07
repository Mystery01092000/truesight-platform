import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { createAwsAdapter } from "@/lib/integrations/aws";
import { runSync } from "@/lib/integrations/sync/orchestrator";
import type { IntegrationAdapter } from "@/lib/integrations/types";

/**
 * Standalone real-AWS discovery runner: `tsx db/sync-cli.ts`.
 *
 * Run it with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npx tsx db/sync-cli.ts
 *
 * Creates its own single-connection Drizzle client (like db/migrate.ts) so it never
 * imports the `server-only` `@/db` module, then builds the management + prod AWS
 * adapters and runs a READ-ONLY sync.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "postgres://truesight:truesight@localhost:5433/truesight";
  const region = process.env.AWS_REGION ?? "ap-south-1";

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  const adapters: IntegrationAdapter[] = [];
  const mgmt = process.env.AWS_MGMT_ACCOUNT_ID;
  const prod = process.env.AWS_PROD_ACCOUNT_ID;
  if (mgmt) adapters.push(createAwsAdapter({ accountId: mgmt, label: "AWS Management" }));
  if (prod) adapters.push(createAwsAdapter({ accountId: prod, label: "AWS Production" }));

  if (adapters.length === 0) {
    await sql.end();
    throw new Error(
      "No AWS account IDs in env (AWS_MGMT_ACCOUNT_ID / AWS_PROD_ACCOUNT_ID). Did you `source .env.local`?",
    );
  }

  console.log(`[sync-cli] discovering ${adapters.length} account(s) in region ${region} ...`);

  for (const a of adapters) {
    const label = (a as { label?: string }).label ?? a.instanceId;
    const h = await a.healthCheck();
    console.log(`[sync-cli] health ${label}: ok=${h.ok} ${h.detail ?? ""}`);
  }

  try {
    const summaries = await runSync({ adapters, trigger: "cli", db });
    for (const s of summaries) {
      console.log(`\n=== ${s.label} (${s.account}) — status=${s.status} ===`);
      console.log(`  resources: ${s.resourceCount}   edges: ${s.edgeCount}`);
      console.log(`  byKind: ${JSON.stringify(s.byKind)}`);
      if (s.errors.length > 0) {
        console.log(`  errors (${s.errors.length}):`);
        for (const e of s.errors) {
          console.log(`    - [${e.scope}] ${e.code}: ${e.message}`);
        }
      }
    }
    const total = summaries.reduce((n, s) => n + s.resourceCount, 0);
    console.log(`\n[sync-cli] DONE — ${total} total resources across ${summaries.length} account(s).`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[sync-cli] failed:", err);
    process.exit(1);
  });
