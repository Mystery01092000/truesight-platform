import "server-only";
import OpenAI from "openai";
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

/**
 * Generate embeddings for a batch of texts.
 * Handles retry/back-off via the OpenAI SDK default behavior.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

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

export function getEmbeddingDimensions(): number {
  return kbConfig().embeddingDimensions;
}
