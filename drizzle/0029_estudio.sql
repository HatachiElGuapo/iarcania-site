-- Módulo Estudio: tabla script_slides + columnas modo_preferido/notas_ia en
-- scripts, y aseguramiento de la tabla brands (IF NOT EXISTS porque puede
-- venir ya de scripts/migrations/008-010 si esta DB es la misma de guiones).
--
-- Este archivo se puede correr tal cual (drizzle-kit migrate o psql). Es
-- idempotente en las partes de brands; las columnas de scripts y la tabla
-- script_slides usan IF NOT EXISTS para poder re-correr sin romper.

CREATE TABLE IF NOT EXISTS "brands" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"nombre" text NOT NULL,
	"colores" jsonb,
	"tipografia" text,
	"logo_url" text,
	"tono_de_voz" text,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "tono_de_voz" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "script_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"tipo" text DEFAULT 'punto' NOT NULL,
	"texto_principal" text NOT NULL,
	"texto_secundario" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_slides_tipo_chk" CHECK ("script_slides"."tipo" IN ('portada','punto','cita','dato','cierre'))
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "modo_preferido" text DEFAULT 'bloques' NOT NULL;
--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "notas_ia" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "script_slides" ADD CONSTRAINT "script_slides_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "script_slides" ADD CONSTRAINT "script_slides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "script_slides_script_idx" ON "script_slides" USING btree ("script_id");
