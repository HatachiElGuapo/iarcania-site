// Carga del plan del dueño de sesión desde la base — sin lógica de
// resolución acá (eso vive en resolve.ts, que no toca la base).
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  plans,
  planPeople,
  planPhases,
  planQueues,
  planQueueItems,
  planBlocks,
  planHolidays,
  planEvents,
  planOverrides,
} from "@/lib/db/schema/plan";
import type { PlanData } from "./resolve";

export type PlanContext = {
  plan: { id: string; name: string; startDate: string; endDate: string };
  people: (typeof planPeople.$inferSelect)[];
  phases: (typeof planPhases.$inferSelect)[];
  queues: (typeof planQueues.$inferSelect)[];
  queueItems: (typeof planQueueItems.$inferSelect)[];
  blocks: (typeof planBlocks.$inferSelect)[];
  holidays: string[];
  events: (typeof planEvents.$inferSelect)[];
  overrides: (typeof planOverrides.$inferSelect)[];
};

// Un usuario tiene un único plan por ahora (el de la casa) — si más
// adelante hace falta más de uno, esto pasa a recibir/filtrar por planId.
export async function loadPlanContext(userId: string): Promise<PlanContext | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.ownerId, userId)).limit(1);
  if (!plan) return null;
  return loadPlanContextById(plan.id);
}

// Como loadPlanContext, pero también resuelve para quien NO es el dueño
// del plan — cualquier persona con su propia columna (planPeople.userId,
// ej. Diana en el plan de Miguel). Antes las páginas de Plan llamaban
// loadPlanContext(userId) directo, que solo mira plans.ownerId: para
// cualquier persona enlazada que no fuera la dueña, esto devolvía null
// ("no hay plan") aunque sí tuviera una columna en el plan de la casa.
export async function loadPlanContextForUser(userId: string): Promise<PlanContext | null> {
  const owned = await loadPlanContext(userId);
  if (owned) return owned;
  const person = await findPlanPersonForUser(userId);
  if (!person) return null;
  return loadPlanContextById(person.planId);
}

export async function loadPlanContextById(planId: string): Promise<PlanContext> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new Error("Plan no encontrado");

  const [people, phases, queues, queueItems, blocks, holidayRows, events, overrides] = await Promise.all([
    db.select().from(planPeople).where(eq(planPeople.planId, plan.id)).orderBy(asc(planPeople.sortOrder)),
    db.select().from(planPhases).where(eq(planPhases.planId, plan.id)).orderBy(asc(planPhases.sortOrder)),
    db.select().from(planQueues).where(eq(planQueues.planId, plan.id)),
    db
      .select({
        id: planQueueItems.id,
        queueId: planQueueItems.queueId,
        phaseId: planQueueItems.phaseId,
        position: planQueueItems.position,
        text: planQueueItems.text,
        notes: planQueueItems.notes,
        scriptId: planQueueItems.scriptId,
        bookId: planQueueItems.bookId,
      })
      .from(planQueueItems)
      .innerJoin(planQueues, eq(planQueues.id, planQueueItems.queueId))
      .where(eq(planQueues.planId, plan.id))
      .orderBy(asc(planQueueItems.position)),
    db.select().from(planBlocks).where(eq(planBlocks.planId, plan.id)),
    db.select({ date: planHolidays.date }).from(planHolidays).where(eq(planHolidays.planId, plan.id)),
    db.select().from(planEvents).where(eq(planEvents.planId, plan.id)),
    db.select().from(planOverrides).where(eq(planOverrides.planId, plan.id)),
  ]);

  return {
    plan: { id: plan.id, name: plan.name, startDate: plan.startDate, endDate: plan.endDate },
    people,
    phases,
    queues,
    queueItems: queueItems as (typeof planQueueItems.$inferSelect)[],
    blocks,
    holidays: holidayRows.map((h) => h.date),
    events,
    overrides,
  };
}

// Encuentra la persona del plan ligada a este usuario — el dueño del plan
// (Miguel) o cualquier otra con user_id propio (Diana). Null si el usuario
// no tiene columna en ningún plan.
export async function findPlanPersonForUser(
  userId: string,
): Promise<{ planId: string; personId: string } | null> {
  const [row] = await db
    .select({ planId: planPeople.planId, personId: planPeople.id })
    .from(planPeople)
    .where(eq(planPeople.userId, userId))
    .limit(1);
  return row ? { planId: row.planId, personId: row.personId } : null;
}

export function toPlanData(ctx: PlanContext): PlanData {
  return {
    startDate: ctx.plan.startDate,
    endDate: ctx.plan.endDate,
    people: ctx.people.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    phases: ctx.phases.map((p) => ({ id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate, goal: p.goal })),
    queues: ctx.queues.map((q) => ({ id: q.id, key: q.key, name: q.name, cyclic: q.cyclic, global: q.global, fallback: q.fallback })),
    queueItems: ctx.queueItems.map((i) => ({ queueId: i.queueId, phaseId: i.phaseId, position: i.position, text: i.text })),
    blocks: ctx.blocks.map((b) => ({
      id: b.id,
      personId: b.personId,
      weekday: b.weekday,
      startTime: b.startTime,
      endTime: b.endTime,
      text: b.text,
      kind: b.kind,
      tentative: b.tentative,
      isMinimum: b.isMinimum,
      queueId: b.queueId,
      holidayText: b.holidayText,
    })),
    holidays: ctx.holidays,
    events: ctx.events.map((e) => ({
      id: e.id,
      personId: e.personId,
      date: e.date,
      monthDay: e.monthDay,
      startTime: e.startTime,
      endTime: e.endTime,
      text: e.text,
      kind: e.kind,
    })),
    overrides: ctx.overrides.map((o) => ({
      date: o.date,
      blockId: o.blockId,
      text: o.text,
      removed: o.removed,
      startTime: o.startTime,
      durationMinutes: o.durationMinutes,
    })),
  };
}
