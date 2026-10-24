CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"department" text NOT NULL,
	"designation" text NOT NULL,
	"daily_cost" numeric(14, 2) NOT NULL,
	"joining_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_site_engineer" boolean DEFAULT false NOT NULL,
	"base_location" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_code_unique" UNIQUE("code"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"project_type_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"work_order_no" text DEFAULT '' NOT NULL,
	"po_no" text DEFAULT '' NOT NULL,
	"contract_value" numeric(14, 2) NOT NULL,
	"estimated_cost" numeric(14, 2) NOT NULL,
	"allotted_man_days" numeric(14, 2) NOT NULL,
	"allotted_expenses" numeric(14, 2) DEFAULT 0 NOT NULL,
	"operational_cost_per_day" numeric(14, 2) DEFAULT 150 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"period_start" date NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_manager_idx" ON "projects" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");