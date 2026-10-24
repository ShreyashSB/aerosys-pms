CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role" text NOT NULL,
	"allocation" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_allocation_check" CHECK ("assignments"."allocation" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "attendance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" text NOT NULL,
	"idle_hours" numeric(4, 2) DEFAULT 0 NOT NULL,
	"idle_reason" text,
	CONSTRAINT "attendance_log_employee_unique" UNIQUE("daily_log_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "boq_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"boq_item_id" uuid NOT NULL,
	"date" date NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"daily_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sr_no" text NOT NULL,
	"description" text NOT NULL,
	"uom" text NOT NULL,
	"contract_qty" numeric(14, 3) NOT NULL,
	"rate" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" date NOT NULL,
	"activities" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_project_date_unique" UNIQUE("project_id","date")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'Aerosys HVAC Solutions Pvt Ltd' NOT NULL,
	"deadline_alert_days" integer DEFAULT 14 NOT NULL,
	"hours_per_man_day" numeric(4, 2) DEFAULT 8 NOT NULL,
	"overhead_pct_of_wages" numeric(5, 2) DEFAULT 20 NOT NULL,
	"projection_method" text DEFAULT 'performance' NOT NULL,
	"target_margin_pct" numeric(5, 2) DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_executions" ADD CONSTRAINT "boq_executions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_executions" ADD CONSTRAINT "boq_executions_boq_item_id_boq_items_id_fk" FOREIGN KEY ("boq_item_id") REFERENCES "public"."boq_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_executions" ADD CONSTRAINT "boq_executions_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_created_by_id_employees_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_project_idx" ON "assignments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "assignments_employee_idx" ON "assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_open_idx" ON "assignments" USING btree ("project_id","employee_id") WHERE "assignments"."end_date" IS NULL;--> statement-breakpoint
CREATE INDEX "attendance_employee_idx" ON "attendance_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "boq_executions_project_idx" ON "boq_executions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "boq_executions_item_idx" ON "boq_executions" USING btree ("boq_item_id");--> statement-breakpoint
CREATE INDEX "boq_items_project_idx" ON "boq_items" USING btree ("project_id");--> statement-breakpoint
-- The single settings row, with the defaults above.
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
