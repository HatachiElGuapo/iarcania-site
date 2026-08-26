CREATE TABLE "purchase_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"priority" text DEFAULT 'media' NOT NULL,
	"target_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_goals_priority_chk" CHECK ("purchase_goals"."priority" IN ('alta','media','baja'))
);
--> statement-breakpoint
ALTER TABLE "purchase_goals" ADD CONSTRAINT "purchase_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_goals_user_idx" ON "purchase_goals" USING btree ("user_id");