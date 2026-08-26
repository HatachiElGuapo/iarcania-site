CREATE TABLE "scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"canal" text DEFAULT 'iarcania' NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"hook" text,
	"body" text,
	"cta" text,
	"notes" text,
	"fecha_grabacion" date,
	"fecha_publicacion" timestamp with time zone,
	"video_url" text,
	"plataformas" text[] DEFAULT '{}' NOT NULL,
	"copy_yt_titulo" text,
	"copy_yt_descripcion" text,
	"copy_ig_caption" text,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pres_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scripts_canal_chk" CHECK ("scripts"."canal" IN ('iarcania','voidstoic')),
	CONSTRAINT "scripts_status_chk" CHECK ("scripts"."status" IN ('borrador','en_progreso','listo_grabar','grabado','publicado'))
);
--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scripts_user_idx" ON "scripts" USING btree ("user_id");