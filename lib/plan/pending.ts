// Pendientes "de verdad": solo bloques is_minimum=true cuyo horario YA pasó
// (hora real America/Bogota) y que no tienen plan_check done/skipped para
// su fecha real. Los secundarios (hábitos enlazados que no son el
// principal) y los que todavía no llegan a su hora no cuentan. Un bloque
// que cruza medianoche (end_time < start_time, ej. Dormir 21:00–04:40)
// vence a esa hora del día SIGUIENTE — se evalúa mirando el bloque de AYER
// desde la vista de hoy, igual que lo "carga" day-events.ts.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import type { PlanContext } from "./load";
import { toPlanData } from "./load";
import { resolvePlan, type ResolvedBlock } from "./resolve";
import { addDaysISO } from "@/lib/date/bogota";

export type PendingMinimumBlock = {
  blockId: string;
  text: string;
  startTime: string;
  dueTime: string; // hora a la que vence (HH:MM)
  effectiveDate: string; // fecha con la que se guardaría el plan_check
};

function crossesMidnight(b: ResolvedBlock): boolean {
  return !b.endTime || b.endTime < b.startTime;
}

export async function getPendingMinimumsForPerson(
  ctx: PlanContext,
  personId: string,
  today: string,
  nowHHMM: string,
): Promise<PendingMinimumBlock[]> {
  const planData = toPlanData(ctx);
  const yesterday = addDaysISO(today, -1);

  const [todayDay] = resolvePlan(planData, today, today);
  const [yesterdayDay] = resolvePlan(planData, yesterday, yesterday);

  const todayMinimums = (todayDay?.blocksByPerson[personId] ?? []).filter((b) => b.isMinimum);
  const yesterdayMinimums = (yesterdayDay?.blocksByPerson[personId] ?? []).filter(
    (b) => b.isMinimum && crossesMidnight(b) && b.endTime,
  );

  const checks = await db
    .select({ blockId: planChecks.blockId, date: planChecks.date })
    .from(planChecks)
    .where(
      and(
        eq(planChecks.planId, ctx.plan.id),
        eq(planChecks.personId, personId),
        inArray(planChecks.date, [yesterday, today]),
      ),
    );
  const checkedSet = new Set(checks.map((c) => `${c.date}:${c.blockId}`));

  const out: PendingMinimumBlock[] = [];

  for (const b of todayMinimums) {
    if (crossesMidnight(b)) continue; // vence mañana, no hoy
    const dueTime = b.endTime ?? "23:59";
    if (nowHHMM < dueTime) continue;
    if (checkedSet.has(`${today}:${b.blockId}`)) continue;
    out.push({ blockId: b.blockId, text: b.text, startTime: b.startTime, dueTime, effectiveDate: today });
  }

  for (const b of yesterdayMinimums) {
    const dueTime = b.endTime!;
    if (nowHHMM < dueTime) continue;
    if (checkedSet.has(`${yesterday}:${b.blockId}`)) continue;
    out.push({ blockId: b.blockId, text: b.text, startTime: b.startTime, dueTime, effectiveDate: yesterday });
  }

  out.sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  return out;
}
