ALTER TABLE "activities" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_parent_id_activities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_parent_idx" ON "activities" USING btree ("parent_id");