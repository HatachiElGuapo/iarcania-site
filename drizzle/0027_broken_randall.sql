-- "Vencido" deja de ser un valor almacenable: se deriva de due_date < hoy
-- y no pagado (lib/agencia/payment-status.ts). Normalizar cualquier fila que
-- lo tenga guardado a mano ANTES de estrechar el CHECK — si no, el ADD
-- CONSTRAINT falla. Hoy son 0 filas, pero el orden importa igual.
UPDATE "crm_payments" SET "status" = 'pendiente' WHERE "status" = 'vencido';--> statement-breakpoint
ALTER TABLE "crm_payments" DROP CONSTRAINT "crm_payments_status_chk";--> statement-breakpoint
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_status_chk" CHECK ("crm_payments"."status" IN ('pendiente','pagado'));
