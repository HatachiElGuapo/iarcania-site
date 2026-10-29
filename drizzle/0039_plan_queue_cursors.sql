CREATE TABLE "plan_queue_cursors" (
	"queue_id" uuid NOT NULL,
	"phase_id" uuid,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_overrides" ADD COLUMN "deferred_queue_item" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_queue_cursors" ADD CONSTRAINT "plan_queue_cursors_queue_id_plan_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."plan_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_queue_cursors" ADD CONSTRAINT "plan_queue_cursors_phase_id_plan_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."plan_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_queue_cursors_phase_group_uidx" ON "plan_queue_cursors" USING btree ("queue_id","phase_id") WHERE "plan_queue_cursors"."phase_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_queue_cursors_global_group_uidx" ON "plan_queue_cursors" USING btree ("queue_id") WHERE "plan_queue_cursors"."phase_id" IS NULL;