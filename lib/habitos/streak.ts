import { addDaysISO } from "@/lib/date/bogota";

// Racha real calculada sobre el historial completo — a diferencia del
// original, que en la tarjeta resumen solo mostraba "✓ hoy"/"✓ esta semana"
// sin contar días consecutivos de verdad. Camina por strings "YYYY-MM-DD"
// vía addDaysISO en vez de mutar un Date con setDate() — evita cualquier
// dependencia de la timezone del proceso.
export function computeDailyStreak(logDates: string[], todayISO: string): number {
  const dates = new Set(logDates);
  let cursor = dates.has(todayISO) ? todayISO : addDaysISO(todayISO, -1);

  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}
