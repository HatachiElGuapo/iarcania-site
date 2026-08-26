CREATE TABLE "important_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'evento' NOT NULL,
	"relationship" text,
	"day" integer NOT NULL,
	"month" integer NOT NULL,
	"person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "important_dates_day_chk" CHECK ("important_dates"."day" BETWEEN 1 AND 31),
	CONSTRAINT "important_dates_month_chk" CHECK ("important_dates"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text DEFAULT 'amigo' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "important_dates_user_idx" ON "important_dates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "important_dates_person_idx" ON "important_dates" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");