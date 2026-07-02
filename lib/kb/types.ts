export type KbSourceType = "s3" | "resource_snapshot" | "github" | "terraform_state";

export interface KbDocumentInput {
  source: KbSourceType;
  externalId: string;
  title?: string;
  url?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface KbIngestOptions {
  sources?: KbSourceType[];
  all?: boolean;
}

export interface KbIngestResult {
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  errors: KbIngestError[];
}

export interface KbIngestError {
  source: KbSourceType;
  externalId: string;
  message: string;
}

export interface KbQueryResult {
  documentId: string;
  chunkId: string;
  source: KbSourceType;
  externalId: string;
  title?: string;
  url?: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface KbQueryFilters {
  sources?: KbSourceType[];
  provider?: string;
  limit?: number;
}
