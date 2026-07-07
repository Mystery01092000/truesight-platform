import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { asc, eq, isNull, sql } from "drizzle-orm";

import * as schema from "@/db/schema";
import { kbChunks, kbEmbeddings } from "@/db/schema";
// Imported from lib/ai/bedrock directly (not lib/kb/embeddings) so the backfill
// always uses Titan v2 regardless of the KB_EMBEDDING_PROVIDER flag.
import { embedTexts } from "@/lib/ai/bedrock";

/**
 * Backfills kb_embeddings.embedding_v2 (Titan v2, 1024 dims) for every chunk
 * that only has the legacy OpenAI embedding: `npm run kb:reembed`.
 *
 * Run it with the environment loaded, e.g.:
 *   set -a && source .env.local && set +a && npm run kb:reembed
 *
 * Creates its own single-connection Drizzle client (like db/github-sync-cli.ts)
 * and holds a session-level pg advisory lock for the whole run so concurrent
 * backfills are impossible. Runs under --conditions=react-server so the
 * `server-only` guard inside lib/ modules is inert.
 *
 * Exit codes:
 *   0 — success (nothing to backfill is success)
 *   1 — lock not acquired or fatal error mid-run
 */

const BATCH_SIZE = 64;
const LOCK_KEY = "kb:reembed";

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_URL ?? "postgres://truesight:truesight@localhost:5433/truesight";
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });

  console.log("[kb-reembed] starting Titan v2 embedding backfill...");

  try {
    const lockRows = await db.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_lock(hashtext(${LOCK_KEY})::bigint) as locked`
    );
    if (!lockRows[0]?.locked) {
      console.error(
        "[kb-reembed] another re-embed run holds the advisory lock; exiting"
      );
      process.exit(1);
    }

    const [{ pending }] = await db
      .select({ pending: sql<number>`count(*)::int` })
      .from(kbEmbeddings)
      .where(isNull(kbEmbeddings.embeddingV2));

    console.log(`[kb-reembed] ${pending} embedding(s) missing embedding_v2`);

    let updated = 0;
    let batchIndex = 0;

    for (;;) {
      const batch = await db
        .select({ embeddingId: kbEmbeddings.id, content: kbChunks.content })
        .from(kbEmbeddings)
        .innerJoin(kbChunks, eq(kbEmbeddings.chunkId, kbChunks.id))
        .where(isNull(kbEmbeddings.embeddingV2))
        .orderBy(asc(kbEmbeddings.id))
        .limit(BATCH_SIZE);

      if (batch.length === 0) break;

      const vectors = await embedTexts(batch.map((row) => row.content));

      await db.transaction(async (tx) => {
        for (let i = 0; i < batch.length; i++) {
          await tx
            .update(kbEmbeddings)
            .set({ embeddingV2: vectors[i] })
            .where(eq(kbEmbeddings.id, batch[i].embeddingId));
        }
      });

      updated += batch.length;
      batchIndex += 1;
      console.log(
        `[kb-reembed] batch ${batchIndex}: ${updated}/${pending} backfilled`
      );
    }

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)::int` })
      .from(kbEmbeddings)
      .where(isNull(kbEmbeddings.embeddingV2));

    console.log(
      `[kb-reembed] done — ${updated} embedding(s) written, ${remaining} still missing`
    );
    process.exitCode = 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kb-reembed] fatal:", message);
    process.exitCode = 1;
  } finally {
    // Closing the single connection also releases the session advisory lock.
    await client.end();
  }
}

main();
