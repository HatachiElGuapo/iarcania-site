ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'media' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "time_end" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_chk" CHECK ("tasks"."priority" IN ('alta','media','baja'));