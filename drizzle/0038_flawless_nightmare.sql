CREATE TABLE "activity_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"notes" text,
	"script_id" uuid,
	"book_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_frequency_chk";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "dias_semana" integer[];--> statement-breakpoint
ALTER TABLE "activity_queue_items" ADD CONSTRAINT "activity_queue_items_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_queue_items" ADD CONSTRAINT "activity_queue_items_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_queue_items" ADD CONSTRAINT "activity_queue_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_queue_items_activity_idx" ON "activity_queue_items" USING btree ("activity_id","position");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_frequency_chk" CHECK ("activities"."frequency" IN ('diaria','semanal','mensual','unica','recurrente','trabajo'));