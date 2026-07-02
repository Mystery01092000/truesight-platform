import "server-only";

import { runKbIngest } from "@/lib/kb/ingest";

/**
 * One-off CLI to populate the Knowledge Base from all configured sources.
 * Intended to run inside the Argus toolbox/sync Fargate task on a schedule.
 *
 * Exit codes:
 *   0 — success (documents may be empty if no sources are configured)
 *   1 — fatal error during ingestion
 */
async function main() {
  console.log("[kb-ingest] starting knowledge base ingestion...");

  try {
    const result = await runKbIngest({ all: true });

    console.log(`[kb-ingest] documents: ${result.documentCount}`);
    console.log(`[kb-ingest] chunks: ${result.chunkCount}`);
    console.log(`[kb-ingest] embeddings: ${result.embeddingCount}`);

    if (result.errors.length > 0) {
      console.warn(`[kb-ingest] ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        console.warn(`  - ${err.source}:${err.externalId} — ${err.message}`);
      }
    }

    console.log("[kb-ingest] done");
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kb-ingest] fatal:", message);
    process.exit(1);
  }
}

main();
