CREATE EXTENSION IF NOT EXISTS "vector";
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer
);
--> statement-breakpoint
CREATE TABLE "kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text,
	"url" text,
	"metadata" jsonb,
	"content_hash" text NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"last_ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_documents_source_external_uq" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "kb_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_embeddings" ADD CONSTRAINT "kb_embeddings_chunk_id_kb_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."kb_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_chunks_document_idx" ON "kb_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "kb_documents_source_idx" ON "kb_documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "kb_embeddings_chunk_idx" ON "kb_embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "kb_embeddings_vector_idx" ON "kb_embeddings" USING hnsw ("embedding" vector_cosine_ops);