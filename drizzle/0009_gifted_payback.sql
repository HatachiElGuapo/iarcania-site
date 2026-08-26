CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enfoque_actual" text,
	"filosofia" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'activo' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_projects_status_chk" CHECK ("life_projects"."status" IN ('activo','completado'))
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "area_id" uuid;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_projects" ADD CONSTRAINT "life_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_projects" ADD CONSTRAINT "life_projects_area_id_life_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_projects" ADD CONSTRAINT "life_projects_parent_id_life_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."life_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_areas_user_idx" ON "life_areas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "life_projects_user_idx" ON "life_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "life_projects_area_idx" ON "life_projects" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "life_projects_parent_idx" ON "life_projects" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_life_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."life_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_area_id_life_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;