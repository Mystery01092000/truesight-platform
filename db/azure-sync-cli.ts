import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  readAzureEnv,
  createAzureCredential,
  resolveSubscription,
} from "@/lib/integrations/azure";
import { createAzureAdapter } from "@/lib/integrations/azure";
import { runSync } from "@/lib/integrations/sync/orchestrator";

/**
 * Standalone real-Azure discovery runner: `tsx db/azure-sync-cli.ts`.
 *
 * Run it with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npx tsx db/azure-sync-cli.ts
 *
 * As a convenience it also self-loads `.env.local` (without printing any values)
 * when the Azure vars are not already present, so a bare `npx tsx` works too.
 *
 * Creates its own single-connection Drizzle client (like db/sync-cli.ts) so it
 * never imports the `server-only` `@/db` module, resolves the Arcane
 * subscription by display name, and runs a READ-ONLY Resource Graph sync.
 */

/** Load KEY=VALUE lines from .env.local into process.env if not already set. Never logs values. */
function loadEnvLocal(): void {
  if (process.env.AZURE_TENANT_ID && process.env.DATABASE_URL) return;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.DATABASE_URL ?? "postgres://truesight:truesight@localhost:5433/truesight";
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  try {
    const env = readAzureEnv();
    const credential = createAzureCredential(env);

    console.log(`[azure-sync] resolving subscription "${env.subscriptionName}" ...`);
    const sub = await resolveSubscription(credential, env.subscriptionName);
    console.log(`[azure-sync] resolved sub=${sub.subscriptionId} name=${sub.displayName} state=${sub.state ?? "?"}`);

    const adapter = createAzureAdapter({
      subscriptionId: sub.subscriptionId,
      subscriptionName: env.subscriptionName,
      label: sub.displayName,
      credential,
      resourceGroup: env.resourceGroup,
    });

    const h = await adapter.healthCheck();
    console.log(`[azure-sync] health ${adapter.label}: ok=${h.ok} ${h.detail ?? ""}`);

    const summaries = await runSync({ adapters: [adapter], trigger: "cli", db });
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
    console.log(`\n[azure-sync] DONE — ${total} total resources across ${summaries.length} subscription(s).`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[azure-sync] failed:", err);
    process.exit(1);
  });
