CREATE TABLE "plan_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"tentative" boolean DEFAULT false NOT NULL,
	"is_minimum" boolean DEFAULT false NOT NULL,
	"queue_id" uuid,
	"holiday_text" text,
	CONSTRAINT "plan_blocks_weekday_chk" CHECK ("plan_blocks"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "plan_blocks_kind_chk" CHECK ("plan_blocks"."kind" IN ('ingresos','juntos','cuidado','comida','casa','rutina','descanso','cita'))
);
--> statement-breakpoint
CREATE TABLE "plan_checks" (
	"plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"block_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" text NOT NULL,
	"resolved_text" text NOT NULL,
	"note" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_checks_date_block_id_pk" PRIMARY KEY("date","block_id"),
	CONSTRAINT "plan_checks_status_chk" CHECK ("plan_checks"."status" IN ('done','skipped'))
);
--> statement-breakpoint
CREATE TABLE "plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"person_id" uuid,
	"date" date,
	"month_day" integer,
	"start_time" text,
	"end_time" text,
	"text" text NOT NULL,
	"kind" text,
	CONSTRAINT "plan_events_date_or_month_day_chk" CHECK ("plan_events"."date" IS NOT NULL OR "plan_events"."month_day" IS NOT NULL),
	CONSTRAINT "plan_events_kind_chk" CHECK ("plan_events"."kind" IS NULL OR "plan_events"."kind" IN ('ingresos','juntos','cuidado','comida','casa','rutina','descanso','cita'))
);
--> statement-breakpoint
CREATE TABLE "plan_holidays" (
	"plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "plan_holidays_plan_id_date_pk" PRIMARY KEY("plan_id","date")
);
--> statement-breakpoint
CREATE TABLE "plan_overrides" (
	"plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"block_id" uuid NOT NULL,
	"text" text,
	"removed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "plan_overrides_date_block_id_pk" PRIMARY KEY("date","block_id")
);
--> statement-breakpoint
CREATE TABLE "plan_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"user_id" uuid,
	"notes" text[],
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"goal" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"phase_id" uuid,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"cyclic" boolean DEFAULT false NOT NULL,
	"global" boolean DEFAULT false NOT NULL,
	"fallback" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_person_id_plan_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."plan_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_blocks" ADD CONSTRAINT "plan_blocks_queue_id_plan_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."plan_queues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_checks" ADD CONSTRAINT "plan_checks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_checks" ADD CONSTRAINT "plan_checks_block_id_plan_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."plan_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_checks" ADD CONSTRAINT "plan_checks_person_id_plan_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."plan_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_person_id_plan_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."plan_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_holidays" ADD CONSTRAINT "plan_holidays_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_overrides" ADD CONSTRAINT "plan_overrides_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_overrides" ADD CONSTRAINT "plan_overrides_block_id_plan_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."plan_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_people" ADD CONSTRAINT "plan_people_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_people" ADD CONSTRAINT "plan_people_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_phases" ADD CONSTRAINT "plan_phases_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD CONSTRAINT "plan_queue_items_queue_id_plan_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."plan_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_queue_items" ADD CONSTRAINT "plan_queue_items_phase_id_plan_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."plan_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_queues" ADD CONSTRAINT "plan_queues_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_blocks_person_weekday_idx" ON "plan_blocks" USING btree ("person_id","weekday");--> statement-breakpoint
CREATE INDEX "plan_checks_plan_date_idx" ON "plan_checks" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "plan_checks_person_date_idx" ON "plan_checks" USING btree ("person_id","date");--> statement-breakpoint
CREATE INDEX "plan_events_plan_date_idx" ON "plan_events" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "plan_overrides_plan_idx" ON "plan_overrides" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_people_plan_idx" ON "plan_people" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_phases_plan_date_idx" ON "plan_phases" USING btree ("plan_id","start_date");--> statement-breakpoint
CREATE INDEX "plan_queue_items_queue_phase_idx" ON "plan_queue_items" USING btree ("queue_id","phase_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_queues_plan_key_idx" ON "plan_queues" USING btree ("plan_id","key");--> statement-breakpoint
CREATE INDEX "plans_owner_idx" ON "plans" USING btree ("owner_id");