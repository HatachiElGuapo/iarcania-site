CREATE TABLE "crm_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"business" text,
	"whatsapp" text,
	"email" text,
	"service" text,
	"monthly_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"start_date" date,
	"status" text DEFAULT 'activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_clients_status_chk" CHECK ("crm_clients"."status" IN ('activo','inactivo','pausado'))
);
--> statement-breakpoint
CREATE TABLE "crm_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"due_date" date,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_payments_status_chk" CHECK ("crm_payments"."status" IN ('pendiente','pagado','vencido'))
);
--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_clients_user_idx" ON "crm_clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "crm_payments_client_idx" ON "crm_payments" USING btree ("client_id");