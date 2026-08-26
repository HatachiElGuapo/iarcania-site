CREATE TABLE "daily_focus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"list_type" text NOT NULL,
	"task_id" uuid NOT NULL,
	"task_type" text DEFAULT 'task' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_focus_list_type_chk" CHECK ("daily_focus"."list_type" IN ('hoy','extra','trabajo'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"due_date" date,
	"time_due" text,
	"category" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_chk" CHECK ("tasks"."status" IN ('pendiente','completada','archivada'))
);
--> statement-breakpoint
CREATE TABLE "work_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"content" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_focus" ADD CONSTRAINT "daily_focus_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_focus" ADD CONSTRAINT "daily_focus_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_focus_user_date_list_idx" ON "daily_focus" USING btree ("user_id","date","list_type");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_focus_unique_task_idx" ON "daily_focus" USING btree ("user_id","date","list_type","task_id");--> statement-breakpoint
CREATE INDEX "tasks_user_due_date_idx" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "work_notes_user_channel_idx" ON "work_notes" USING btree ("user_id","channel");