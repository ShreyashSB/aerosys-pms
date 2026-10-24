CREATE TABLE "engineer_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comments" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engineer_reviews_project_employee_unique" UNIQUE("project_id","employee_id"),
	CONSTRAINT "engineer_reviews_rating_check" CHECK ("engineer_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "instrument_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"engineer_id" uuid,
	"assigned_at" date NOT NULL,
	"returned_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"serial_number" text NOT NULL,
	"category" text NOT NULL,
	"asset_value" numeric(14, 2) NOT NULL,
	"purchase_date" date NOT NULL,
	"end_of_life_date" date NOT NULL,
	"current_location" text DEFAULT '' NOT NULL,
	"calibration" jsonb,
	"status" text DEFAULT 'available' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_code_unique" UNIQUE("code"),
	CONSTRAINT "instruments_asset_value_positive" CHECK ("instruments"."asset_value" > 0),
	CONSTRAINT "instruments_life_check" CHECK ("instruments"."end_of_life_date" > "instruments"."purchase_date")
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engineer_reviews" ADD CONSTRAINT "engineer_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_reviews" ADD CONSTRAINT "engineer_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_reviews" ADD CONSTRAINT "engineer_reviews_reviewer_id_employees_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_deployments" ADD CONSTRAINT "instrument_deployments_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_deployments" ADD CONSTRAINT "instrument_deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_deployments" ADD CONSTRAINT "instrument_deployments_engineer_id_employees_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_id_employees_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engineer_reviews_employee_idx" ON "engineer_reviews" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "instrument_deployments_project_idx" ON "instrument_deployments" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instrument_deployments_one_open_idx" ON "instrument_deployments" USING btree ("instrument_id") WHERE "instrument_deployments"."returned_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_serial_idx" ON "instruments" USING btree (lower("serial_number"));--> statement-breakpoint
CREATE INDEX "project_documents_project_idx" ON "project_documents" USING btree ("project_id");