CREATE TABLE "access_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_email" text NOT NULL,
	"requester_name" text NOT NULL,
	"team" text NOT NULL,
	"project" text NOT NULL,
	"reporting_manager" text NOT NULL,
	"tools" jsonb NOT NULL,
	"purpose" text,
	"timeline" text NOT NULL,
	"timeline_custom" text,
	"vpn_access" boolean DEFAULT false NOT NULL,
	"vpn_mac_address" text,
	"manager_approved" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"approver_role" text NOT NULL,
	"approver_email" text,
	"decision" text,
	"decided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"tool" text NOT NULL,
	"access_mode" text NOT NULL,
	"resource_identity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_approvals" ADD CONSTRAINT "ticket_approvals_ticket_id_access_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."access_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_resources" ADD CONSTRAINT "ticket_resources_ticket_id_access_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."access_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_status_log" ADD CONSTRAINT "ticket_status_log_ticket_id_access_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."access_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_tickets_email_idx" ON "access_tickets" USING btree ("requester_email");--> statement-breakpoint
CREATE INDEX "access_tickets_status_idx" ON "access_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_approvals_ticket_idx" ON "ticket_approvals" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_resources_ticket_idx" ON "ticket_resources" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_status_log_ticket_idx" ON "ticket_status_log" USING btree ("ticket_id");