ALTER TABLE "plan_blocks" DROP CONSTRAINT "plan_blocks_kind_chk";--> statement-breakpoint
ALTER TABLE "plan_events" DROP CONSTRAINT "plan_events_kind_chk";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "reminder_activity_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "reminder_text" text;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_reminder_activity_id_activities_id_fk" FOREIGN KEY ("reminder_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_reminder_activity_idx" ON "activities" USING btree ("reminder_activity_id");--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_kind_chk" CHECK ("plan_blocks"."kind" IN ('ingresos','juntos','cuidado','comida','casa','rutina','descanso','cita','secundarios'));--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_kind_chk" CHECK ("plan_events"."kind" IS NULL OR "plan_events"."kind" IN ('ingresos','juntos','cuidado','comida','casa','rutina','descanso','cita','secundarios'));