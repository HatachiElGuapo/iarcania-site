// Normalización de hora/duración de un bloque de agenda. Módulo puro (sin
// "use server") para poder reutilizarlo y verificarlo fuera de una acción.

// "HH:MM" 24 h, snap a 10 min, dentro del día (00:00–23:50).
export function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) throw new Error("Hora inválida");
  const total = Math.min(23 * 60 + 50, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
  const snapped = Math.round(total / 10) * 10;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
}

// Mínimo 20 min (mínimo de actividad de la app), múltiplos de 10, tope 24 h.
export function normalizeDuration(raw: number): number {
  return Math.min(24 * 60, Math.max(20, Math.round((raw || 20) / 10) * 10));
}
