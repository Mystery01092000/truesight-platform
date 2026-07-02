import "server-only";
import { serverEnv } from "@/lib/config/env";

export type KbEmbeddingModel = "text-embedding-3-small";
export type KbEmbeddingProvider = "openai" | "bedrock";
export type KbEmbeddingColumn = "embedding" | "embeddingV2";

export interface KbConfig {
  openaiApiKey: string;
  bucketName: string;
  /** Which embedding provider serves reads/writes (KB_EMBEDDING_PROVIDER). */
  activeProvider: KbEmbeddingProvider;
  /** OpenAI embedding model — the Bedrock model id lives in env/lib/ai/bedrock. */
  embeddingModel: KbEmbeddingModel;
  embeddingDimensions: number;
  /** kb_embeddings column the active provider reads/writes (dual-column migration). */
  embeddingColumn: KbEmbeddingColumn;
  maxTokensPerChunk: number;
  chunkOverlapTokens: number;
  embeddingBatchSize: number;
}

export function kbConfig(): KbConfig {
  const env = serverEnv();
  const activeProvider = env.KB_EMBEDDING_PROVIDER;
  const isBedrock = activeProvider === "bedrock";

  return {
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    bucketName: env.KB_BUCKET_NAME,
    activeProvider,
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: isBedrock ? 1024 : 1536,
    embeddingColumn: isBedrock ? "embeddingV2" : "embedding",
    maxTokensPerChunk: 512,
    chunkOverlapTokens: 100,
    embeddingBatchSize: 64,
  };
}
