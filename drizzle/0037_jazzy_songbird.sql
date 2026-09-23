ALTER TABLE "plan_queue_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD COLUMN "script_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD COLUMN "book_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD CONSTRAINT "plan_queue_items_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD CONSTRAINT "plan_queue_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;