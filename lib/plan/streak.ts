// Racha de "días con todos los mínimos cumplidos" — calculada siempre desde
// plan_checks (sin tabla nueva): se simula día por día desde plans.start_date
// hasta la fecha pedida, usando el resolver + los checks reales de cada día.
// La lógica pura (simulateStreak/deriveDayCompletions/excludeTodayInProgress)
// vive en streak-pure.ts, sin import de DB — ver ese archivo para las
// reglas y lib/plan/streak.test.ts para la prueba sin conexión real.
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { and, eq, gte, lte } from "drizzle-orm";
import type { PlanContext } from "./load";
import { toPlanData } from "./load";
import { resolvePlan } from "./resolve";
import { deriveDayCompletions, excludeTodayInProgress, simulateStreak, type StreakResult } from "./streak-pure";

export type { DayCompletion, StreakResult } from "./streak-pure";
export { simulateStreak, deriveDayCompletions, excludeTodayInProgress };

// Trae, para `personId`, si cada día entre plan.startDate y `uptoDate`
// (incluida) tuvo algún bloque is_minimum ese weekday y si todos quedaron
// en "done" — listo para pasarle a simulateStreak.
export async function getStreakForPerson(ctx: PlanContext, personId: string, uptoDate: string): Promise<StreakResult> {
  if (uptoDate < ctx.plan.startDate) return { streak: 0, protectors: 0, best: 0 };

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

  const dayCompletions = excludeTodayInProgress(deriveDayCompletions(resolved, personId, doneSet), uptoDate);

  return simulateStreak(dayCompletions);
}
