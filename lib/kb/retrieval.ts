import "server-only";

import { and, asc, desc, eq, inArray, sql, cosineDistance } from "drizzle-orm";
import { db } from "@/db";
import { kbChunks, kbDocuments, kbEmbeddings } from "@/db/schema";
import { serverEnv } from "@/lib/config/env";
import { embedTexts } from "./embeddings";
import type { KbQueryFilters, KbQueryResult, KbSourceType } from "./types";

const RRF_K = 60;
const FETCH_MULTIPLIER = 10;

export async function queryKb(
  query: string,
  filters?: KbQueryFilters
): Promise<KbQueryResult[]> {
  const env = serverEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to query the knowledge base");
  }

  if (!query.trim()) {
    return [];
  }

  const limit = filters?.limit ?? 10;
  const fetchLimit = Math.max(limit * FETCH_MULTIPLIER, 50);

  const [queryEmbedding] = await embedTexts([query]);

  const baseFilter = buildFilter(filters);

  const semanticRows = await db
    .select({
      chunkId: kbChunks.id,
      documentId: kbDocuments.id,
      source: kbDocuments.source,
      externalId: kbDocuments.externalId,
      title: kbDocuments.title,
      url: kbDocuments.url,
      content: kbChunks.content,
      metadata: kbDocuments.metadata,
      distance: cosineDistance(kbEmbeddings.embedding, queryEmbedding),
    })
    .from(kbEmbeddings)
    .innerJoin(kbChunks, eq(kbEmbeddings.chunkId, kbChunks.id))
    .innerJoin(kbDocuments, eq(kbChunks.documentId, kbDocuments.id))
    .where(baseFilter)
    .orderBy(asc(cosineDistance(kbEmbeddings.embedding, queryEmbedding)))
    .limit(fetchLimit);

  const tsQuery = sql`plainto_tsquery('english', ${query})`;
  const keywordRows = await db
    .select({
      chunkId: kbChunks.id,
      documentId: kbDocuments.id,
      source: kbDocuments.source,
      externalId: kbDocuments.externalId,
      title: kbDocuments.title,
      url: kbDocuments.url,
      content: kbChunks.content,
      metadata: kbDocuments.metadata,
      rank: sql<number>`ts_rank_cd(to_tsvector('english', ${kbChunks.content}), ${tsQuery})`,
    })
    .from(kbChunks)
    .innerJoin(kbDocuments, eq(kbChunks.documentId, kbDocuments.id))
    .where(
      and(
        sql`to_tsvector('english', ${kbChunks.content}) @@ ${tsQuery}`,
        baseFilter
      )
    )
    .orderBy(
      desc(sql`ts_rank_cd(to_tsvector('english', ${kbChunks.content}), ${tsQuery})`)
    )
    .limit(fetchLimit);

  const semanticMap = new Map(
    semanticRows.map((row, idx) => [row.chunkId, { rank: idx + 1, row }])
  );
  const keywordMap = new Map(
    keywordRows.map((row, idx) => [row.chunkId, { rank: idx + 1, row }])
  );

  const merged = new Map<string, KbQueryResult & { score: number }>();

  for (const [chunkId, { rank, row }] of semanticMap) {
    const keywordRank = keywordMap.get(chunkId)?.rank;
    const score =
      1 / (RRF_K + rank) +
      (keywordRank ? 1 / (RRF_K + keywordRank) : 0);
    merged.set(chunkId, {
      documentId: row.documentId,
      chunkId: row.chunkId,
      source: row.source as KbSourceType,
      externalId: row.externalId,
      title: row.title ?? undefined,
      url: row.url ?? undefined,
      content: row.content,
      score,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    });
  }

  for (const [chunkId, { rank, row }] of keywordMap) {
    if (merged.has(chunkId)) continue;
    const score = 1 / (RRF_K + rank);
    merged.set(chunkId, {
      documentId: row.documentId,
      chunkId: row.chunkId,
      source: row.source as KbSourceType,
      externalId: row.externalId,
      title: row.title ?? undefined,
      url: row.url ?? undefined,
      content: row.content,
      score,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildFilter(filters?: KbQueryFilters) {
  const conditions: (ReturnType<typeof sql> | undefined)[] = [];

  if (filters?.sources && filters.sources.length > 0) {
    conditions.push(inArray(kbDocuments.source, filters.sources));
  }

  if (filters?.provider) {
    conditions.push(
      sql`${kbDocuments.metadata} ->> 'provider' = ${filters.provider}`
    );
  }

  const defined = conditions.filter(Boolean) as ReturnType<typeof sql>[];
  return defined.length > 0 ? and(...defined) : sql`true`;
}
