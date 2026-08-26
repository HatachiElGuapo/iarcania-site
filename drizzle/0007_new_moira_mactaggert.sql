CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_content" text NOT NULL,
	"processed_content" text,
	"source" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'nueva' NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ideas_status_chk" CHECK ("ideas"."status" IN ('nueva','procesada'))
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_user_idx" ON "ideas" USING btree ("user_id");