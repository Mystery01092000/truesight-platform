CREATE TABLE IF NOT EXISTS "forge_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "canvas_json" jsonb NOT NULL,
  "tf_json" jsonb,
  "tf_state" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_plans_status_idx" ON "forge_plans" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "forge_plans"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "log" text DEFAULT '' NOT NULL,
  "exit_code" integer,
  "triggered_by" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_runs_plan_idx" ON "forge_runs" ("plan_id");
