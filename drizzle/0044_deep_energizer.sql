ALTER TABLE "plan_blocks" ADD COLUMN "flexible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "plan_blocks" SET "flexible" = true WHERE "text" ILIKE 'Almuerzo%';