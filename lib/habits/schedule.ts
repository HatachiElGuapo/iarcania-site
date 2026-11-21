import { weekdayMon0 } from "@/lib/date/bogota";

// activities.dias_semana: null o vacío = todos los días (comportamiento de
// siempre). Con algo puesto, el hábito/subhábito solo aplica esos días —
// no se muestra, no cuenta para completar su padre/bloque ni para rachas
// los demás días. Mismo orden 0=lunes…6=domingo que weekdayMon0/
// plan_blocks.weekday (el selector "Días" del menú ⋯ usa L M M J V S D,
// lunes primero) — igual que ya usaba este campo para frequency='trabajo'.
export function isScheduledOnWeekday(diasSemana: number[] | null | undefined, weekday: number): boolean {
  return !diasSemana || diasSemana.length === 0 || diasSemana.includes(weekday);
}

export function isScheduledOnDate(diasSemana: number[] | null | undefined, dateISO: string): boolean {
  return isScheduledOnWeekday(diasSemana, weekdayMon0(dateISO));
}

// Lee los checkboxes/botones "Días" de un FormData (name="diasSemana",
// uno por weekday marcado) — vacío = null = todos los días. Compartido
// entre updateActivity/createActivity (habitos/actions.ts) y
// updateHabitNode (plan/actions.ts), los dos puntos donde se edita este
// campo.
export function parseDiasSemana(formData: FormData): number[] | null {
  const raw = formData
    .getAll("diasSemana")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return raw.length ? [...new Set(raw)].sort((a, b) => a - b) : null;
}
