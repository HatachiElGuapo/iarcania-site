// Lógica PURA de la racha de Plan — separada de streak.ts porque ese
// archivo importa lib/db/client.ts (conexión real) para getStreakForPerson,
// y este módulo necesita poder probarse (lib/plan/streak.test.ts) y
// usarse desde el cliente sin arrastrar esa conexión — mismo motivo que
// lib/plan/secondary-bands.ts.
import type { ResolvedDay } from "./resolve";
import { todayISO } from "@/lib/date/bogota";

export type DayCompletion = { hasMinimums: boolean; allDone: boolean };

export type StreakResult = { streak: number; protectors: number; best: number };

// Reglas (confirmadas con el usuario):
//  - Un día sin ningún bloque is_minimum ese weekday no cuenta ni para ni
//    contra la racha (se ignora, ni "bueno" ni "fallado").
//  - Un día fallado (algún mínimo sin done) no rompe la racha por sí solo,
//    pero NO suma, y reinicia el conteo de 3 días consecutivos cumplidos
//    (goodRun) que hace falta para el siguiente protector.
//  - Un SEGUNDO día fallado consecutivo rompe la racha a 0 — salvo que haya
//    un protector disponible, que se consume automáticamente y la racha
//    sigue intacta (y el "contador de fallo pendiente" se limpia: el
//    próximo fallo vuelve a ser "el primero").
//  - Cada 3 días consecutivos cumplidos (goodRun) suma 1 protector, máximo
//    2 acumulados.
export function simulateStreak(dayCompletions: DayCompletion[]): StreakResult {
  let streak = 0;
  let protectors = 0;
  let goodRun = 0;
  let pendingMiss = false;
  let best = 0;

  for (const d of dayCompletions) {
    if (!d.hasMinimums) continue; // día sin mínimos: no cuenta ni para ni contra

    if (d.allDone) {
      streak++;
      if (streak > best) best = streak;
      goodRun++;
      pendingMiss = false;
      if (goodRun >= 3) {
        protectors = Math.min(2, protectors + 1);
        goodRun = 0;
      }
    } else {
      goodRun = 0;
      if (pendingMiss) {
        if (protectors > 0) {
          protectors--;
          pendingMiss = false;
        } else {
          streak = 0;
          pendingMiss = false;
        }
      } else {
        pendingMiss = true;
      }
    }
  }

  return { streak, protectors, best };
}

// Para cada día resuelto, si tuvo algún bloque is_minimum y si todos
// quedaron "done" — `resolved` ya viene filtrado por resolvePlan (weekday
// === weekdayMon0(fecha) y createdAt <= fecha, ver resolve.ts), así que
// acá NUNCA se mira "todos los bloques del plan": solo los que resolvePlan
// ya decidió que aplican ESE día. `doneSet` se busca por `${fecha}:
// ${blockId}` del bloque RESUELTO para ese día — un plan_check viejo
// colgado en un bloque de otro weekday (ver fix anterior en
// applyHabitToggle) nunca entra en esta llave, así que no puede ensuciar
// el cálculo aunque no se haya limpiado la base todavía.
export function deriveDayCompletions(resolved: ResolvedDay[], personId: string, doneSet: Set<string>): DayCompletion[] {
  return resolved.map((day) => {
    const minimums = (day.blocksByPerson[personId] ?? []).filter((b) => b.isMinimum);
    return {
      hasMinimums: minimums.length > 0,
      allDone: minimums.length > 0 && minimums.every((b) => doneSet.has(`${day.date}:${b.blockId}`)),
    };
  });
}

// El último día de la simulación, si es HOY de verdad (no un `uptoDate`
// pasado) y todavía no se completó, no cuenta como fallo — sigue en
// curso, puede cumplirse más tarde. A diferencia de un día pasado sin
// marcar (que sí es un fallo real), acá no hay que ni sumarlo ni
// restarlo: se excluye de la simulación entera (ni pendingMiss ni
// goodRun se tocan), no se lo "pasa por la rama de fallo" — eso evita
// que, si ayer también falló, hoy en curso se cuente como el "segundo
// fallo consecutivo" que rompería la racha antes de que el día termine.
export function excludeTodayInProgress(
  dayCompletions: DayCompletion[],
  uptoDate: string,
  today: string = todayISO(),
): DayCompletion[] {
  if (dayCompletions.length === 0 || uptoDate !== today) return dayCompletions;
  const last = dayCompletions[dayCompletions.length - 1];
  if (!last.hasMinimums || last.allDone) return dayCompletions;
  return [...dayCompletions.slice(0, -1), { hasMinimums: false, allDone: false }];
}
