CREATE TABLE "recursos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"tipo" text DEFAULT 'curso' NOT NULL,
	"estado" text DEFAULT 'vivo' NOT NULL,
	"nivel_min" text,
	"visible_para" text[] DEFAULT '{}' NOT NULL,
	"contenido" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recursos_tipo_chk" CHECK ("recursos"."tipo" IN ('curso','sop','prompt','workflow','plantilla','entregable')),
	CONSTRAINT "recursos_estado_chk" CHECK ("recursos"."estado" IN ('vivo','en-progreso','pendiente','archivado'))
);
--> statement-breakpoint
CREATE TABLE "recursos_sensibles" (
	"recurso_id" uuid PRIMARY KEY NOT NULL,
	"contenido" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos_sensibles" ADD CONSTRAINT "recursos_sensibles_recurso_id_recursos_id_fk" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recursos_user_idx" ON "recursos" USING btree ("user_id");