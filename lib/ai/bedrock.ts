import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import pLimit from "p-limit";

import { serverEnv } from "@/lib/config/env";

/**
 * Lazy singleton Bedrock runtime client. Credentials come from the AWS default
 * chain (task role on Fargate, env/profile locally) — never hardcoded.
 */
let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (client) return client;
  client = new BedrockRuntimeClient({ region: serverEnv().BEDROCK_REGION });
  return client;
}

// Titan v2 has no batch API — one InvokeModel per text, bounded concurrency.
const EMBED_CONCURRENCY = 8;

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

function wrapBedrockError(err: unknown, modelId: string, region: string): Error {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (name === "AccessDeniedException") {
    return new Error(
      `Bedrock access denied for ${modelId} in ${region}. Enable model access in the Bedrock console for this region and verify the caller role allows bedrock:InvokeModel* — ${message}`
    );
  }
  if (name === "ValidationException" || name === "ResourceNotFoundException") {
    return new Error(
      `Bedrock rejected model ${modelId} in ${region}. Check BEDROCK_REGION and the model id — the model may not exist in this region or may require an inference profile id — ${message}`
    );
  }
  return err instanceof Error ? err : new Error(message);
}

/**
 * Embed texts with Titan Embed v2 (1024 dims, normalized). Order of the
 * returned vectors matches the input order.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const env = serverEnv();
  const bedrock = getClient();
  const limit = pLimit(EMBED_CONCURRENCY);

  return Promise.all(
    texts.map((text) =>
      limit(async () => {
        try {
          const response = await bedrock.send(
            new InvokeModelCommand({
              modelId: env.BEDROCK_EMBEDDING_MODEL,
              contentType: "application/json",
              accept: "application/json",
              body: JSON.stringify({
                inputText: text,
                dimensions: 1024,
                normalize: true,
              }),
            })
          );
          const payload = JSON.parse(new TextDecoder().decode(response.body)) as {
            embedding?: number[];
          };
          if (!Array.isArray(payload.embedding)) {
            throw new Error("Titan response contained no embedding array");
          }
          return payload.embedding;
        } catch (err) {
          throw wrapBedrockError(err, env.BEDROCK_EMBEDDING_MODEL, env.BEDROCK_REGION);
        }
      })
    )
  );
}

/**
 * Single-shot generation via Converse on BEDROCK_GENERATION_MODEL.
 */
export async function generate(
  messages: BedrockMessage[],
  system?: string
): Promise<string> {
  const env = serverEnv();

  try {
    const response = await getClient().send(
      new ConverseCommand({
        modelId: env.BEDROCK_GENERATION_MODEL,
        system: system ? [{ text: system }] : undefined,
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
        inferenceConfig: { maxTokens: 2048, temperature: 0.2 },
      })
    );
    const blocks = response.output?.message?.content ?? [];
    return blocks.map((block) => block.text ?? "").join("");
  } catch (err) {
    throw wrapBedrockError(err, env.BEDROCK_GENERATION_MODEL, env.BEDROCK_REGION);
  }
}

/**
 * Streaming generation — yields text deltas as they arrive.
 */
export async function* generateStream(
  messages: BedrockMessage[],
  system?: string
): AsyncGenerator<string> {
  const env = serverEnv();

  try {
    const response = await getClient().send(
      new ConverseStreamCommand({
        modelId: env.BEDROCK_GENERATION_MODEL,
        system: system ? [{ text: system }] : undefined,
        messages: messages.map((m) => ({
          role: m.role,
          content: [{ text: m.content }],
        })),
        inferenceConfig: { maxTokens: 2048, temperature: 0.2 },
      })
    );

    for await (const event of response.stream ?? []) {
      const text = event.contentBlockDelta?.delta?.text;
      if (text) yield text;
    }
  } catch (err) {
    throw wrapBedrockError(err, env.BEDROCK_GENERATION_MODEL, env.BEDROCK_REGION);
  }
}
