ALTER TABLE "tasks" DROP CONSTRAINT "tasks_recurso_id_recursos_id_fk";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_recurso_id_recursos_id_fk";
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_recurso_id_recursos_id_fk";
--> statement-breakpoint
ALTER TABLE "plan_blocks" DROP CONSTRAINT "plan_blocks_recurso_id_recursos_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "recurso_id";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "recurso_id";--> statement-breakpoint
ALTER TABLE "activities" DROP COLUMN "recurso_id";--> statement-breakpoint
ALTER TABLE "plan_blocks" DROP COLUMN "recurso_id";