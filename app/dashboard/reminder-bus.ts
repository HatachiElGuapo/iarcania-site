"use client";

// Recordatorio al completar un hábito (ver activities.reminder_activity_id/
// reminder_text, applyHabitToggle) — mismo patrón de módulo global (no
// Context) que modal-stack.ts/busy-guard.ts: SafeActionButton dispara
// showReminder() apenas detecta `reminder` en el resultado de CUALQUIER
// toggleLogToday/adjustCounter (árbol, tarjetas, móvil — da igual desde
// dónde se tocó), y el único <ReminderModal> montado en el layout escucha y
// se abre, sin que cada pantalla tenga que saber nada de esto.
export type ReminderPayload = { targetActivityId: string; text: string; date: string };

const listeners = new Set<(payload: ReminderPayload) => void>();

export function showReminder(payload: ReminderPayload) {
  for (const l of listeners) l(payload);
}

export function subscribeReminder(listener: (payload: ReminderPayload) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
