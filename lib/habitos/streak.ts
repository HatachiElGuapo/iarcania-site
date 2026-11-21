import { addDaysISO, mondayOfWeekISO } from "@/lib/date/bogota";

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

// Para un hábito no diario (activities.weeklyTarget, ver lib/db/schema/
// habitos.ts): cuántos días lleva marcados esta semana (lunes–domingo,
// Bogotá) y en cuántas semanas CONSECUTIVAS cumplió la meta — mismo
// criterio de "gracia" que computeDailyStreak: si la semana actual todavía
// no llegó a la meta, no rompe la racha (todavía puede cumplirse, la
// semana no terminó), simplemente no cuenta y se sigue mirando hacia
// atrás desde la semana pasada.
export function computeWeeklyStreak(
  logDates: string[],
  weeklyTarget: number,
  todayISO: string,
): { countThisWeek: number; streakWeeks: number } {
  const dates = new Set(logDates);
  function countInWeek(monday: string): number {
    let count = 0;
    for (let i = 0; i < 7; i++) if (dates.has(addDaysISO(monday, i))) count++;
    return count;
  }

  const thisMonday = mondayOfWeekISO(todayISO);
  const countThisWeek = countInWeek(thisMonday);

  let cursor = countThisWeek >= weeklyTarget ? thisMonday : addDaysISO(thisMonday, -7);
  let streakWeeks = 0;
  while (countInWeek(cursor) >= weeklyTarget) {
    streakWeeks++;
    cursor = addDaysISO(cursor, -7);
  }
  return { countThisWeek, streakWeeks };
}
