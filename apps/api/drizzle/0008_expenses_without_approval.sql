-- Expenses no longer go through approval: Accounts records them and they count at once.
-- Rejected claims never counted towards cost, so they are removed rather than turned into costs.
-- Pending ones are kept and now count, as if Accounts had recorded them.
DELETE FROM "expenses" WHERE "status" = 'rejected';--> statement-breakpoint
DELETE FROM "notifications" WHERE "type" IN ('expense_submitted', 'expense_approved', 'expense_rejected');--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_reviewed_by_id_employees_id_fk";
--> statement-breakpoint
DROP INDEX "expenses_status_idx";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "reviewed_by_id";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "review_note";