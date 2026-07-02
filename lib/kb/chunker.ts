import { encode, decode } from "gpt-tokenizer";
import { kbConfig } from "./config";

export interface Chunk {
  content: string;
  tokenCount: number;
}

/**
 * Split text into overlapping fixed-size token windows.
 *
 * Strategy:
 * 1. Encode the entire text into tokens.
 * 2. If it fits within `maxTokens`, return it as a single chunk.
 * 3. Otherwise slide a window of `maxTokens` tokens across the token array,
 *    advancing by `maxTokens - overlapTokens` each step, and decode each
 *    window back to text as a chunk.
 */
export function chunkText(
  text: string,
  maxTokens: number = kbConfig().maxTokensPerChunk,
  overlapTokens: number = kbConfig().chunkOverlapTokens
): Chunk[] {
  if (!text.trim()) return [];

  const tokens = encode(text);
  if (tokens.length <= maxTokens) {
    return [
      {
        content: text.trim(),
        tokenCount: tokens.length,
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + maxTokens, tokens.length);
    const windowTokens = tokens.slice(start, end);
    const content = decode(windowTokens).trim();

    if (content) {
      chunks.push({
        content,
        tokenCount: windowTokens.length,
      });
    }

    if (end >= tokens.length) break;

    // Advance by chunk size minus overlap, but never backward.
    const step = Math.max(1, maxTokens - overlapTokens);
    start += step;
  }

  return chunks;
}

export function countTokens(text: string): number {
  return encode(text).length;
}
