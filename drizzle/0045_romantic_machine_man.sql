ALTER TABLE "plan_blocks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "plan_blocks" SET "created_at" = '2026-11-18';