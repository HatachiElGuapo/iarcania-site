CREATE TABLE "plan_block_activities" (
	"block_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	CONSTRAINT "plan_block_activities_block_id_activity_id_pk" PRIMARY KEY("block_id","activity_id")
);
--> statement-breakpoint
ALTER TABLE "plan_blocks" DROP CONSTRAINT "plan_blocks_activity_id_activities_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_block_activities" ADD CONSTRAINT "plan_block_activities_block_id_plan_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."plan_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_block_activities" ADD CONSTRAINT "plan_block_activities_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_block_activities_activity_idx" ON "plan_block_activities" USING btree ("activity_id");--> statement-breakpoint
ALTER TABLE "plan_blocks" DROP COLUMN "activity_id";