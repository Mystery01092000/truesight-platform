CREATE TABLE "cost_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"service" text,
	"day" timestamp with time zone NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_rollups_dims_uq" UNIQUE("provider","account","service","day")
);
--> statement-breakpoint
CREATE TABLE "developer_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"team" text,
	"repo" text,
	"loc" integer DEFAULT 0 NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"commits" integer DEFAULT 0 NOT NULL,
	"languages" jsonb,
	"highlights" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developer_stats_login_repo_uq" UNIQUE("login","repo")
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "terraform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"key" text NOT NULL,
	"name" text,
	"env" text,
	"service" text,
	"size_bytes" integer,
	"last_modified" timestamp with time zone,
	"summary" jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terraform_plans_bucket_key_uq" UNIQUE("bucket","key")
);
--> statement-breakpoint
CREATE TABLE "vulnerability_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"urn" text,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"severity" text,
	"title" text,
	"description" text,
	"mitigation" text,
	"package_name" text,
	"cve" text,
	"resource_link" text,
	"status" text DEFAULT 'open' NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "vulnerability_findings_source_external_uq" UNIQUE("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "kb_embeddings" ADD COLUMN "embedding_v2" vector(1024);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "entra_oid" text;--> statement-breakpoint
CREATE INDEX "cost_rollups_day_idx" ON "cost_rollups" USING btree ("day");--> statement-breakpoint
CREATE INDEX "cost_rollups_service_idx" ON "cost_rollups" USING btree ("service");--> statement-breakpoint
CREATE INDEX "developer_stats_login_idx" ON "developer_stats" USING btree ("login");--> statement-breakpoint
CREATE INDEX "developer_stats_team_idx" ON "developer_stats" USING btree ("team");--> statement-breakpoint
CREATE INDEX "terraform_plans_env_idx" ON "terraform_plans" USING btree ("env");--> statement-breakpoint
CREATE INDEX "terraform_plans_modified_idx" ON "terraform_plans" USING btree ("last_modified");--> statement-breakpoint
CREATE INDEX "vulnerability_findings_urn_idx" ON "vulnerability_findings" USING btree ("urn");--> statement-breakpoint
CREATE INDEX "vulnerability_findings_severity_idx" ON "vulnerability_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "vulnerability_findings_status_idx" ON "vulnerability_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kb_embeddings_vector_v2_idx" ON "kb_embeddings" USING hnsw ("embedding_v2" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_entra_oid_unique" UNIQUE("entra_oid");