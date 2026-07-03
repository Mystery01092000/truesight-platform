import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { runCostSync } from "@/lib/integrations/sync/cost-sync";

/**
 * Standalone cost sync runner: `npm run db:cost-sync`.
 *
 * Run it with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npm run db:cost-sync
 *
 * Creates its own single-connection Drizzle client (like db/sync-cli.ts) so it never
 * imports the `server-only` `@/db` module, then pulls AWS Cost Explorer + Azure Cost
 * Management for the default window and replaces the matching `cost_snapshots` rows.
 * Runs under --conditions=react-server so the `server-only` guard inside the cost
 * adapters is inert.
 *
 * Exit codes:
 *   0 — success ("ok" or "partial": whatever came back was persisted)
 *   1 — overall status "error" (no provider returned rows) or a fatal crash
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "postgres://argus:argus@localhost:5433/argus";
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });

  console.log("[cost-sync-cli] pulling AWS Cost Explorer + Azure Cost Management ...");

  try {
    const summary = await runCostSync({ db, trigger: "scheduled" });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.status === "error") {
      console.error("[cost-sync-cli] FAILED — no provider returned any cost rows.");
      process.exitCode = 1;
    } else {
      console.log(
        `[cost-sync-cli] DONE — status=${summary.status}, ${summary.totalRows} row(s) persisted.`,
      );
    }
  } finally {
    await client.end();
  }
}

// process.exit (not exitCode): the cacheable() layer may hold a live Redis
// connection that keeps the event loop alive forever — same reason sync-cli exits hard.
main()
  .then(() => process.exit(process.exitCode === 1 ? 1 : 0))
  .catch((err: unknown) => {
    console.error("[cost-sync-cli] failed:", err);
    process.exit(1);
  });
