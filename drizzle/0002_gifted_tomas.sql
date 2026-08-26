CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_type" text NOT NULL,
	"description" text,
	"location" text DEFAULT 'casa' NOT NULL,
	"calories" integer,
	"protein_g" numeric(6, 1),
	"carbs_g" numeric(6, 1),
	"fat_g" numeric(6, 1),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meals_meal_type_chk" CHECK ("meals"."meal_type" IN ('desayuno','almuerzo','cena','snack')),
	CONSTRAINT "meals_location_chk" CHECK ("meals"."location" IN ('casa','fuera'))
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kcal_target" integer DEFAULT 2000 NOT NULL,
	"prot_target" numeric(6, 1) DEFAULT 150 NOT NULL,
	"carb_target" numeric(6, 1) DEFAULT 200 NOT NULL,
	"fat_target" numeric(6, 1) DEFAULT 65 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meals_user_date_idx" ON "meals" USING btree ("user_id","date");