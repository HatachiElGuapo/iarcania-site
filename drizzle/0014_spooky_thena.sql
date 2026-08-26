CREATE TABLE "chore_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chore_type_id" uuid NOT NULL,
	"date" date NOT NULL,
	"done_by" text,
	"done_at" text,
	"duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_logs" ADD CONSTRAINT "chore_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_logs" ADD CONSTRAINT "chore_logs_chore_type_id_chore_types_id_fk" FOREIGN KEY ("chore_type_id") REFERENCES "public"."chore_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_types" ADD CONSTRAINT "chore_types_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chore_logs_user_date_idx" ON "chore_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "chore_logs_type_date_idx" ON "chore_logs" USING btree ("chore_type_id","date");--> statement-breakpoint
CREATE INDEX "chore_types_user_idx" ON "chore_types" USING btree ("user_id");