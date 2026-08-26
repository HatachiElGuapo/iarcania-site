CREATE TABLE "agenda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"block_time" text NOT NULL,
	"item_id" uuid,
	"item_type" text DEFAULT 'nota' NOT NULL,
	"duration" integer DEFAULT 20 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_items_user_date_idx" ON "agenda_items" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "agenda_items_unique_slot_item_idx" ON "agenda_items" USING btree ("user_id","date","block_time","item_id");