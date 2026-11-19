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
import { loadHabitTreesByBlock, type HabitNode } from "./sub-habits";
import { splitPrincipalSecondary } from "./secondary";

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

export type PendingSecondaryHabit = {
  activityId: string;
  name: string;
  horaSugerida: string | null;
  dueTime: string; // hora_sugerida si la tiene, si no la hora de fin del bloque
  blockId: string;
  blockText: string;
  blockStartTime: string;
};

// Un nodo entero (él mismo y toda su descendencia) sin ningún registro
// hoy — a diferencia de `!node.done` (que es false también cuando SOLO
// ALGUNOS hijos están marcados), esto exige que NINGUNO lo esté. Un nodo
// hoja se reduce a `!node.done`.
function isFullyUntouched(n: HabitNode): boolean {
  if (n.children.length === 0) return !n.done;
  return !n.done && n.children.every(isFullyUntouched);
}

// Hábitos y subhábitos SECUNDARIOS (is_optional=true en algún ancestro —
// se recorre el forest que ya separó splitPrincipalSecondary, así que
// CADA nodo acá es secundario por herencia, tenga o no su propio flag) no
// cuentan para mínimos/racha, solo son un recordatorio aparte:
//
// - Un nodo HOJA aparece apenas pasa SU hora (hora_sugerida propia, o la
//   de fin del bloque si no tiene) y sigue sin marcar — ej. "Dientes
//   mañana" a las 4:40.
// - Un nodo con HIJOS (ej. "Dientes") nunca aparece por su propia hora —
//   solo es un catch-all al final del día: aparece recién cuando llega
//   la hora de inicio del bloque "Dormir" (el bloque is_minimum que cruza
//   medianoche — ver crossesMidnight), y solo si NINGUNO de sus
//   descendientes (ni él mismo) tiene registro hoy. Si marcaste aunque
//   sea uno, no vuelve a aparecer.
//
// No mira el bloque de AYER que cruza medianoche (a diferencia de
// getPendingMinimumsForPerson): los secundarios siempre cuelgan de un
// bloque de HOY.
export async function getPendingSecondaryHabits(
  ctx: PlanContext,
  userId: string,
  personId: string,
  today: string,
  nowHHMM: string,
): Promise<PendingSecondaryHabit[]> {
  const planData = toPlanData(ctx);
  const [todayDay] = resolvePlan(planData, today, today);
  const blocks = todayDay?.blocksByPerson[personId] ?? [];
  if (blocks.length === 0) return [];

  const dormirBlock = blocks.find((b) => crossesMidnight(b));
  const endOfDayCutoff = dormirBlock?.startTime ?? "23:59";

  const habitTreesByBlock = await loadHabitTreesByBlock(ctx.plan.id, userId, today);
  const out: PendingSecondaryHabit[] = [];

  function walk(nodes: HabitNode[], blockId: string, blockText: string, blockStartTime: string, blockDueTime: string) {
    for (const n of nodes) {
      const isLeaf = n.children.length === 0;
      const dueTime = isLeaf ? (n.horaSugerida ?? blockDueTime) : endOfDayCutoff;
      const untouched = isLeaf ? !n.done : isFullyUntouched(n);
      if (untouched && dueTime <= nowHHMM) {
        out.push({
          activityId: n.activityId,
          name: n.name,
          horaSugerida: n.horaSugerida,
          dueTime,
          blockId,
          blockText,
          blockStartTime,
        });
      }
      walk(n.children, blockId, blockText, blockStartTime, blockDueTime);
    }
  }

  for (const b of blocks) {
    const tree = habitTreesByBlock.get(b.blockId) ?? [];
    const { secondary } = splitPrincipalSecondary(tree);
    const blockDueTime = b.endTime ?? b.startTime;
    walk(secondary, b.blockId, b.text, b.startTime, blockDueTime);
  }

  out.sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  return out;
}
