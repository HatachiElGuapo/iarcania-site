ALTER TABLE "activities" ADD COLUMN "target_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "count_steps" integer[];