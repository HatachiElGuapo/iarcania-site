CREATE TABLE "script_derivados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plataforma" text NOT NULL,
	"formato" text,
	"duracion" text,
	"estado" text DEFAULT 'idea' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_derivados_estado_chk" CHECK ("script_derivados"."estado" IN ('idea','grabando','editando','publicado'))
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "formato" text DEFAULT 'Video largo' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "plataforma_origen" text DEFAULT 'YouTube' NOT NULL;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "hora_grab" text;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "hora_pub" text;--> statement-breakpoint
ALTER TABLE "script_derivados" ADD CONSTRAINT "script_derivados_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_derivados" ADD CONSTRAINT "script_derivados_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "script_derivados_script_idx" ON "script_derivados" USING btree ("script_id");