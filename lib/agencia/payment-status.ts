// Estado efectivo de un cobro de agencia (crm_payments).
//
// `status` en la base es solo 'pendiente' | 'pagado'. "Vencido" NO se
// almacena: se deriva de `due_date < hoy` y no pagado. Este es el único
// lugar donde vive esa regla — el badge, el banner "por cobrar", el total
// por cliente y cualquier consumidor futuro llaman acá.
//
// `today` es "YYYY-MM-DD" en zona Bogotá (de lib/date/bogota.ts · todayISO).
// `due_date` es un `date` de Postgres, que Drizzle entrega como string
// "YYYY-MM-DD": la comparación es string vs string en formato ISO, correcta
// lexicográficamente y sin construir ningún Date (sin riesgo de timezone).
//
// Bordes:
//   - due_date === today  -> NO vencido (tiene el día para pagar).
//   - due_date IS NULL     -> nunca vencido.

export type StoredPaymentStatus = "pendiente" | "pagado";
export type EffectivePaymentStatus = "pendiente" | "pagado" | "vencido";

type PaymentLike = { status: string; dueDate: string | null };

export function effectivePaymentStatus(
  p: PaymentLike,
  today: string,
): EffectivePaymentStatus {
  if (p.status === "pagado") return "pagado";
  if (p.dueDate && p.dueDate < today) return "vencido";
  return "pendiente";
}

// "Te deben esta plata y no está pagada" — pendiente o vencido.
export function isOwed(p: PaymentLike, today: string): boolean {
  return effectivePaymentStatus(p, today) !== "pagado";
}
