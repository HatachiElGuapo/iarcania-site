ALTER TABLE "tasks" ADD COLUMN "plan_block_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_block_id_plan_blocks_id_fk" FOREIGN KEY ("plan_block_id") REFERENCES "public"."plan_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_plan_block_idx" ON "tasks" USING btree ("plan_block_id");