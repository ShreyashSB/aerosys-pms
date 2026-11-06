-- Operational cost is charged per man-day, as in Aerosys's costing sheet, not per calendar day.
ALTER TABLE "projects" RENAME COLUMN "operational_cost_per_day" TO "operational_cost_per_man_day";--> statement-breakpoint
-- The costing sheet's profit-margin target is >20%.
ALTER TABLE "settings" ALTER COLUMN "target_margin_pct" SET DEFAULT 20;--> statement-breakpoint
UPDATE "settings" SET "target_margin_pct" = 20 WHERE "target_margin_pct" = 15;
