CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"severity" text,
	"position" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"urn" text,
	"rule_id" text NOT NULL,
	"framework" text,
	"title" text,
	"description" text,
	"remediation" text,
	"severity" text,
	"status" text DEFAULT 'fail' NOT NULL,
	"details" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"service" text,
	"tag_product" text,
	"amount" numeric(20, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"granularity" text DEFAULT 'DAILY' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"owner_id" uuid,
	"layout" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "drift_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"urn" text NOT NULL,
	"env" text,
	"module" text,
	"classification" text NOT NULL,
	"diff" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"ssm_path" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_accounts_provider_external_uq" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "integration_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"resource_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"trigger" text
);
--> statement-breakpoint
CREATE TABLE "resource_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_urn" text NOT NULL,
	"target_urn" text NOT NULL,
	"kind" text NOT NULL,
	"attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_edges_triple_uq" UNIQUE("source_urn","target_urn","kind")
);
--> statement-breakpoint
CREATE TABLE "resource_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_id" uuid,
	"urn" text NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"region" text,
	"service" text,
	"type" text,
	"native_type" text,
	"name" text,
	"native_id" text,
	"environment" text,
	"status" text,
	"tags" jsonb,
	"attributes" jsonb,
	"source" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"urn" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"region" text,
	"service" text,
	"type" text,
	"name" text,
	"environment" text,
	"status" text,
	"tags" jsonb,
	"attributes" jsonb,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"present" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_posture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"urn" text,
	"provider" text,
	"category" text,
	"title" text,
	"severity" text,
	"exposed" boolean DEFAULT false NOT NULL,
	"score" integer,
	"details" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"config" jsonb,
	"position" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync" ADD CONSTRAINT "integration_sync_account_id_integration_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_snapshots" ADD CONSTRAINT "resource_snapshots_sync_id_integration_sync_id_fk" FOREIGN KEY ("sync_id") REFERENCES "public"."integration_sync"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_idx" ON "checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "compliance_findings_urn_idx" ON "compliance_findings" USING btree ("urn");--> statement-breakpoint
CREATE INDEX "compliance_findings_severity_idx" ON "compliance_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "compliance_findings_rule_idx" ON "compliance_findings" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "cost_snapshots_provider_idx" ON "cost_snapshots" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "cost_snapshots_service_idx" ON "cost_snapshots" USING btree ("service");--> statement-breakpoint
CREATE INDEX "cost_snapshots_period_idx" ON "cost_snapshots" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "cost_snapshots_product_idx" ON "cost_snapshots" USING btree ("tag_product");--> statement-breakpoint
CREATE INDEX "drift_findings_urn_idx" ON "drift_findings" USING btree ("urn");--> statement-breakpoint
CREATE INDEX "drift_findings_classification_idx" ON "drift_findings" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "drift_findings_env_idx" ON "drift_findings" USING btree ("env");--> statement-breakpoint
CREATE INDEX "integration_accounts_provider_idx" ON "integration_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integration_sync_account_idx" ON "integration_sync" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "integration_sync_started_idx" ON "integration_sync" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "resource_edges_source_idx" ON "resource_edges" USING btree ("source_urn");--> statement-breakpoint
CREATE INDEX "resource_edges_target_idx" ON "resource_edges" USING btree ("target_urn");--> statement-breakpoint
CREATE INDEX "resource_snapshots_urn_idx" ON "resource_snapshots" USING btree ("urn");--> statement-breakpoint
CREATE INDEX "resource_snapshots_sync_idx" ON "resource_snapshots" USING btree ("sync_id");--> statement-breakpoint
CREATE INDEX "resource_snapshots_provider_idx" ON "resource_snapshots" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "resource_snapshots_captured_idx" ON "resource_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "resources_provider_idx" ON "resources" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "resources_environment_idx" ON "resources" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "resources_service_idx" ON "resources" USING btree ("service");--> statement-breakpoint
CREATE INDEX "resources_status_idx" ON "resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "resources_tags_gin_idx" ON "resources" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "security_posture_urn_idx" ON "security_posture" USING btree ("urn");--> statement-breakpoint
CREATE INDEX "security_posture_severity_idx" ON "security_posture" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "widgets_dashboard_idx" ON "widgets" USING btree ("dashboard_id");