"use client";

import type { KbIngestResult, KbQueryResult, KbSourceType } from "./types";

export interface KbStatusResponse {
  ok: boolean;
  documentCount: number;
  chunkCount: number;
  sources: { source: KbSourceType; count: number }[];
  lastIngestedAt: string | null;
}

export interface KbDocument {
  id: string;
  source: KbSourceType;
  externalId: string;
  title: string | null;
  url: string | null;
  chunkCount: number;
  lastIngestedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface KbDocumentsResponse {
  ok: boolean;
  documents: KbDocument[];
  count: number;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.message || body.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function queryKb(
  query: string,
  options?: { limit?: number; sources?: KbSourceType[]; provider?: string },
): Promise<KbQueryResult[]> {
  const res = await fetch("/api/kb/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 10, ...options }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = (await res.json()) as { ok: boolean; results: KbQueryResult[] };
  return body.results;
}

export async function getKbStatus(): Promise<KbStatusResponse> {
  const res = await fetch("/api/kb/status", { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as KbStatusResponse;
}

export async function getKbDocuments(options?: {
  source?: KbSourceType;
  limit?: number;
  offset?: number;
}): Promise<KbDocumentsResponse> {
  const params = new URLSearchParams();
  if (options?.source) params.set("source", options.source);
  params.set("limit", String(options?.limit ?? 20));
  params.set("offset", String(options?.offset ?? 0));
  const res = await fetch(`/api/kb/documents?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as KbDocumentsResponse;
}

export async function deleteKbDocument(id: string): Promise<void> {
  const res = await fetch(`/api/kb/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export interface PresignResponse {
  ok: boolean;
  url: string;
  key: string;
}

export async function presignKbUpload(
  key: string,
  contentType?: string,
): Promise<PresignResponse> {
  const res = await fetch("/api/kb/documents/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as PresignResponse;
}

export async function uploadToPresignedUrl(
  url: string,
  file: File,
  contentType?: string,
): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType ?? file.type ?? "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export async function ingestKb(sources?: KbSourceType[], all?: boolean): Promise<KbIngestResult> {
  const res = await fetch("/api/kb/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources, all }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = (await res.json()) as { ok: boolean; result: KbIngestResult };
  return body.result;
}
