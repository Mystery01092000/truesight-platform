import "server-only";
import OpenAI from "openai";
import { embedTexts as bedrockEmbedTexts } from "@/lib/ai/bedrock";
import { kbConfig } from "./config";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const cfg = kbConfig();
  if (!cfg.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required to generate embeddings");
  }
  client = new OpenAI({ apiKey: cfg.openaiApiKey });
  return client;
}

async function embedTextsOpenai(texts: string[]): Promise<number[][]> {
  const cfg = kbConfig();
  const openai = getClient();

  const response = await openai.embeddings.create({
    model: cfg.embeddingModel,
    input: texts,
    encoding_format: "float",
    dimensions: cfg.embeddingDimensions,
  });

  const embeddings = response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`
    );
  }

  return embeddings;
}

/**
 * Generate embeddings for a batch of texts with the active provider
 * (KB_EMBEDDING_PROVIDER). Retry/back-off is handled by each SDK.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (kbConfig().activeProvider === "bedrock") {
    return bedrockEmbedTexts(texts);
  }
  return embedTextsOpenai(texts);
}

export function getEmbeddingDimensions(): number {
  return kbConfig().embeddingDimensions;
}
