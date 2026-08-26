CREATE TABLE "budget_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"income_id" uuid NOT NULL,
	"amount_assigned" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creditor" text NOT NULL,
	"debtor" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"monthly_payment" numeric(12, 2),
	"due_date" date,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debts_status_chk" CHECK ("debts"."status" IN ('active','paid'))
);
--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "distribution_applied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stage" text DEFAULT 'contacted' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "anticipo_pct" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "anticipo_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget_distributions" ADD CONSTRAINT "budget_distributions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_distributions" ADD CONSTRAINT "budget_distributions_income_id_income_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."income"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_distributions_budget_idx" ON "budget_distributions" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_distributions_income_idx" ON "budget_distributions" USING btree ("income_id");--> statement-breakpoint
CREATE INDEX "budgets_user_month_idx" ON "budgets" USING btree ("user_id","year","month");--> statement-breakpoint
CREATE INDEX "debts_user_idx" ON "debts" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_stage_chk" CHECK ("projects"."stage" IN ('contacted','demo','proposal','negotiation','won','lost'));