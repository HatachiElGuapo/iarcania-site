CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'otro' NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"travel_before_minutes" integer,
	"travel_after_minutes" integer,
	"location" text,
	"doctor_name" text,
	"reminder_1_at" timestamp with time zone,
	"reminder_2_at" timestamp with time zone,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"event_type_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_type_chk" CHECK ("appointments"."type" IN ('medica','odontologica','reunion','otro')),
	CONSTRAINT "appointments_status_chk" CHECK ("appointments"."status" IN ('pendiente','completada','cancelada'))
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_user_datetime_idx" ON "appointments" USING btree ("user_id","datetime");