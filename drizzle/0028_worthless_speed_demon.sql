CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'expense' NOT NULL,
	"monthly_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"current_month_spent" numeric(12, 2) DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_category_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"income_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount_assigned" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creditor" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"monthly_payment" numeric(12, 2),
	"due_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_category_distributions" ADD CONSTRAINT "budget_category_distributions_income_id_income_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."income"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_category_distributions" ADD CONSTRAINT "budget_category_distributions_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_debts" ADD CONSTRAINT "personal_debts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_categories_user_idx" ON "budget_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_category_distributions_income_idx" ON "budget_category_distributions" USING btree ("income_id");--> statement-breakpoint
CREATE INDEX "personal_debts_user_idx" ON "personal_debts" USING btree ("user_id");