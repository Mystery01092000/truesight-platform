import "server-only";
import { serverEnv } from "@/lib/config/env";

export type KbEmbeddingModel = "text-embedding-3-small";

export interface KbConfig {
  openaiApiKey: string;
  bucketName: string;
  embeddingModel: KbEmbeddingModel;
  embeddingDimensions: number;
  maxTokensPerChunk: number;
  chunkOverlapTokens: number;
  embeddingBatchSize: number;
}

export function kbConfig(): KbConfig {
  const env = serverEnv();

  return {
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    bucketName: env.KB_BUCKET_NAME,
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    maxTokensPerChunk: 512,
    chunkOverlapTokens: 100,
    embeddingBatchSize: 64,
  };
}
