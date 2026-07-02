import "server-only";

import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { kbDocuments, kbChunks, kbEmbeddings } from "@/db/schema";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddings";
import { kbConfig } from "./config";
import { listKbDocuments } from "./sources/s3";
import { listResourceDocuments } from "./sources/resources";
import { listGithubDocuments } from "./sources/github";
import { listTerraformStateDocuments } from "./sources/terraform";
import type {
  KbDocumentInput,
  KbIngestError,
  KbIngestOptions,
  KbIngestResult,
  KbSourceType,
} from "./types";

const SOURCE_ADAPTERS: Record<
  KbSourceType,
  () => Promise<KbDocumentInput[]> | KbDocumentInput[]
> = {
  s3: listKbDocuments,
  resource_snapshot: listResourceDocuments,
  github: listGithubDocuments,
  terraform_state: listTerraformStateDocuments,
};

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

async function loadDocuments(
  opts: KbIngestOptions
): Promise<{ documents: KbDocumentInput[]; errors: KbIngestError[] }> {
  const enabledSources =
    opts.all || !opts.sources || opts.sources.length === 0
      ? (Object.keys(SOURCE_ADAPTERS) as KbSourceType[])
      : opts.sources;

  const documents: KbDocumentInput[] = [];
  const errors: KbIngestError[] = [];

  await Promise.all(
    enabledSources.map(async (source) => {
      const loader = SOURCE_ADAPTERS[source];
      if (!loader) {
        errors.push({
          source,
          externalId: "__source__",
          message: `No adapter registered for source ${source}`,
        });
        return;
      }
      try {
        const docs = await loader();
        documents.push(...docs);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          source,
          externalId: "__source__",
          message,
        });
      }
    })
  );

  return { documents, errors };
}

async function ingestDocument(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  doc: KbDocumentInput
): Promise<{ chunks: number; embeddings: number }> {
  const contentHash = sha256(doc.content);
  const lockKey = sql`${doc.source} || ':' || ${doc.externalId}`;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`
  );

  const existing = await tx
    .select({ id: kbDocuments.id, contentHash: kbDocuments.contentHash })
    .from(kbDocuments)
    .where(
      sql`${kbDocuments.source} = ${doc.source} and ${kbDocuments.externalId} = ${doc.externalId}`
    )
    .limit(1);

  let docId: string;
  const isUnchanged = existing.length > 0 && existing[0].contentHash === contentHash;

  if (isUnchanged) {
    return { chunks: 0, embeddings: 0 };
  }

  if (existing.length > 0) {
    docId = existing[0].id;
    await tx.delete(kbChunks).where(eq(kbChunks.documentId, docId));
  } else {
    const inserted = await tx
      .insert(kbDocuments)
      .values({
        source: doc.source,
        externalId: doc.externalId,
        title: doc.title ?? null,
        url: doc.url ?? null,
        metadata: doc.metadata ?? {},
        contentHash,
        chunkCount: 0,
      })
      .returning({ id: kbDocuments.id });
    docId = inserted[0].id;
  }

  const chunks = chunkText(doc.content);
  if (chunks.length === 0) {
    await tx
      .update(kbDocuments)
      .set({ contentHash, chunkCount: 0 })
      .where(eq(kbDocuments.id, docId));
    return { chunks: 0, embeddings: 0 };
  }

  const insertedChunks = await tx
    .insert(kbChunks)
    .values(
      chunks.map((chunk, position) => ({
        documentId: docId,
        position,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
      }))
    )
    .returning({ id: kbChunks.id, content: kbChunks.content });

  let embeddingCount = 0;
  const batchSize = kbConfig().embeddingBatchSize;
  for (let i = 0; i < insertedChunks.length; i += batchSize) {
    const batch = insertedChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);
    const embeddings = await embedTexts(texts);

    await tx.insert(kbEmbeddings).values(
      batch.map((chunk, idx) => ({
        chunkId: chunk.id,
        embedding: embeddings[idx],
      }))
    );
    embeddingCount += embeddings.length;
  }

  await tx
    .update(kbDocuments)
    .set({ contentHash, chunkCount: insertedChunks.length })
    .where(eq(kbDocuments.id, docId));

  return { chunks: insertedChunks.length, embeddings: embeddingCount };
}

export async function runKbIngest(
  opts: KbIngestOptions = {}
): Promise<KbIngestResult> {
  const { documents, errors } = await loadDocuments(opts);

  let documentCount = 0;
  let chunkCount = 0;
  let embeddingCount = 0;

  // Ingest sequentially so a single document failure does not roll back others.
  for (const doc of documents) {
    try {
      const result = await db.transaction(async (tx) => {
        return ingestDocument(tx, doc);
      });
      documentCount += 1;
      chunkCount += result.chunks;
      embeddingCount += result.embeddings;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        source: doc.source,
        externalId: doc.externalId,
        message,
      });
    }
  }

  return {
    documentCount,
    chunkCount,
    embeddingCount,
    errors,
  };
}
