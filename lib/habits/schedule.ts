import { weekdayMon0 } from "@/lib/date/bogota";

// activities.dias_semana: null o vacío = todos los días (comportamiento de
// siempre). Con algo puesto, el hábito/subhábito solo aplica esos días —
// no se muestra, no cuenta para completar su padre/bloque ni para rachas
// los demás días. 0=lunes…6=domingo, el índice que calcula weekdayMon0()
// (el selector "Días" del menú ⋯ usa L M M J V S D, lunes primero) — igual
// que ya usaba este campo para frequency='trabajo'.
//
// Este índice se calcula SIEMPRE acá, directo desde la fecha (Bogotá) vía
// weekdayMon0() — nunca a partir de plan_blocks.weekday ni de ninguna otra
// función que asuma que ambos campos comparten convención. Son dos campos
// de tablas distintas (activities vs plan_blocks); aunque las dos usan
// Mon-0 en el código de este repo, no hay que comparar uno contra el otro
// ni reusar un valor ya resuelto por el resolver de Plan.
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
