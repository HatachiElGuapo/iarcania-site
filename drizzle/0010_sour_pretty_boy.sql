CREATE TABLE "event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"cost" numeric(12, 2),
	"people" text,
	"location" text,
	"notes" text,
	"mood" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_occurrences_mood_chk" CHECK ("event_occurrences"."mood" IS NULL OR "event_occurrences"."mood" IN ('genial','normal','dificil'))
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'visita' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_category_chk" CHECK ("event_types"."category" IN ('cultural','amigos','familia','visita'))
);
--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_occurrences_type_date_idx" ON "event_occurrences" USING btree ("event_type_id","date");--> statement-breakpoint
CREATE INDEX "event_occurrences_user_idx" ON "event_occurrences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_types_user_idx" ON "event_types" USING btree ("user_id");