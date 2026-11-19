// Sin "use client" a propósito: resuelve qué Server Action dispara el
// toggle principal de una fila de "Tu día" (DayEventRow en el dashboard
// cliente, MobileDayRow en el Server Component de app/dashboard/page.tsx).
// Antes vivía en day-event-row.tsx ("use client"); llamarla desde un
// Server Component revienta en runtime ("Attempted to call X from the
// server but X is on the client") aunque la función sea pura — cualquier
// export de un módulo "use client" se vuelve una referencia de cliente, no
// solo los componentes. Server Actions (toggleTaskStatus, etc.) sí pueden
// cruzar esa frontera sin problema: por eso quedan importadas aquí.
import type { AgendaEvent } from "@/lib/agenda/day-events";
import { toggleTaskStatus } from "@/app/dashboard/actividades/actions";
import { toggleLogToday } from "@/app/dashboard/habitos/actions";
import { setCheck } from "@/app/dashboard/plan/actions";
import { completeAppointment } from "@/app/dashboard/citas/actions";

export type RowAction = (formData: FormData) => void | Promise<unknown>;

// El toggle "principal" de cada fila — el que se dispara clickeando en
// cualquier parte de la fila, no solo un cuadradito chico. Plan además
// tiene "saltado" (✗) como control aparte, porque hecho/saltado no son
// opuestos de un solo booleano.
export function primaryActionFor(
  ev: AgendaEvent,
  date: string,
): { action: RowAction; fields: Record<string, string> } | null {
  if (ev.kind === "block" && ev.itemType === "task" && ev.itemId) {
    return { action: toggleTaskStatus, fields: { id: ev.itemId, nextStatus: ev.done ? "pendiente" : "completada" } };
  }
  if ((ev.kind === "habit" || (ev.kind === "block" && ev.itemType === "habito")) && ev.itemId) {
    return { action: toggleLogToday, fields: { activityId: ev.itemId, date } };
  }
  if (ev.kind === "block" && ev.itemType === "cita" && ev.itemId) {
    return { action: completeAppointment, fields: { id: ev.itemId } };
  }
  if (ev.kind === "plan") {
    return { action: setCheck, fields: { date, blockId: ev.refId, status: ev.done ? "" : "done" } };
  }
  return null;
}
