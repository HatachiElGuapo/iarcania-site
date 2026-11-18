// Racha de "días con todos los mínimos cumplidos" — calculada siempre desde
// plan_checks (sin tabla nueva): se simula día por día desde plans.start_date
// hasta la fecha pedida, usando el resolver + los checks reales de cada día.
//
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
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { and, eq, gte, lte } from "drizzle-orm";
import type { PlanContext } from "./load";
import { toPlanData } from "./load";
import { resolvePlan } from "./resolve";

export type StreakResult = { streak: number; protectors: number };

export function simulateStreak(dayCompletions: { hasMinimums: boolean; allDone: boolean }[]): StreakResult {
  let streak = 0;
  let protectors = 0;
  let goodRun = 0;
  let pendingMiss = false;

  for (const d of dayCompletions) {
    if (!d.hasMinimums) continue; // día sin mínimos: no cuenta ni para ni contra

    if (d.allDone) {
      streak++;
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

  return { streak, protectors };
}

// Trae, para `personId`, si cada día entre plan.startDate y `uptoDate`
// (incluida) tuvo algún bloque is_minimum ese weekday y si todos quedaron
// en "done" — listo para pasarle a simulateStreak.
export async function getStreakForPerson(ctx: PlanContext, personId: string, uptoDate: string): Promise<StreakResult> {
  if (uptoDate < ctx.plan.startDate) return { streak: 0, protectors: 0 };

  const planData = toPlanData(ctx);
  const resolved = resolvePlan(planData, ctx.plan.startDate, uptoDate, uptoDate);

  const checks = await db
    .select({ blockId: planChecks.blockId, date: planChecks.date, status: planChecks.status })
    .from(planChecks)
    .where(
      and(
        eq(planChecks.planId, ctx.plan.id),
        eq(planChecks.personId, personId),
        gte(planChecks.date, ctx.plan.startDate),
        lte(planChecks.date, uptoDate),
      ),
    );
  const doneSet = new Set(checks.filter((c) => c.status === "done").map((c) => `${c.date}:${c.blockId}`));

  const dayCompletions = resolved.map((day) => {
    const minimums = (day.blocksByPerson[personId] ?? []).filter((b) => b.isMinimum);
    return {
      hasMinimums: minimums.length > 0,
      allDone: minimums.length > 0 && minimums.every((b) => doneSet.has(`${day.date}:${b.blockId}`)),
    };
  });

  return simulateStreak(dayCompletions);
}
