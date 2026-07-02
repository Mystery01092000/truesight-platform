import "server-only";

import { generate, generateStream } from "@/lib/ai/bedrock";
import { queryKb } from "./retrieval";
import type { KbQueryResult } from "./types";

const DEFAULT_TOP_K = 8;

const SYSTEM_PROMPT = `You are the Argus infrastructure copilot for the CentricityWealthTech multi-cloud estate (AWS, Azure, GitHub, Terraform).
Answer ONLY from the numbered context blocks provided in the user message — never from outside knowledge.
Cite the blocks that support each statement inline as [n].
If the context is insufficient or unrelated to the question, say so explicitly instead of guessing.`;

export interface KbCitation {
  n: number;
  chunkId: string;
  documentId: string;
  title?: string;
  url?: string;
}

export interface KbAnswer {
  answer: string | null;
  citations: KbCitation[];
}

export interface KbAnswerOptions {
  topK?: number;
}

function buildUserPrompt(query: string, chunks: KbQueryResult[]): string {
  const context = chunks
    .map((chunk, idx) => {
      const heading = chunk.title ? `${chunk.title} — ` : "";
      return `[${idx + 1}] ${heading}${chunk.source}:${chunk.externalId}\n${chunk.content}`;
    })
    .join("\n\n");
  return `Context:\n${context}\n\nQuestion: ${query}`;
}

function toCitations(chunks: KbQueryResult[]): KbCitation[] {
  return chunks.map((chunk, idx) => ({
    n: idx + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    url: chunk.url,
  }));
}

export async function answerQuestion(
  query: string,
  opts?: KbAnswerOptions
): Promise<KbAnswer> {
  const chunks = await queryKb(query, { limit: opts?.topK ?? DEFAULT_TOP_K });
  if (chunks.length === 0) {
    return { answer: null, citations: [] };
  }

  const answer = await generate(
    [{ role: "user", content: buildUserPrompt(query, chunks) }],
    SYSTEM_PROMPT
  );

  return { answer, citations: toCitations(chunks) };
}

/**
 * Streaming variant — emits SSE lines: {type:'delta',text}* then
 * {type:'done',citations}. Errors after headers are sent surface as a
 * terminal {type:'error',message} event.
 */
export async function answerQuestionStream(
  query: string,
  opts?: KbAnswerOptions
): Promise<ReadableStream<Uint8Array>> {
  const chunks = await queryKb(query, { limit: opts?.topK ?? DEFAULT_TOP_K });
  const citations = toCitations(chunks);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        if (chunks.length > 0) {
          const stream = generateStream(
            [{ role: "user", content: buildUserPrompt(query, chunks) }],
            SYSTEM_PROMPT
          );
          for await (const text of stream) {
            send({ type: "delta", text });
          }
        }
        send({ type: "done", citations });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
}
