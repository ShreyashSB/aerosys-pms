CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_employee_id" uuid,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_label" text NOT NULL,
	"project_id" uuid,
	"project_label" text,
	"action" text NOT NULL,
	"summary" text,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_project_idx" ON "audit_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_employee_id");