// Desajustes entre `activities` (hábitos) y `plan_blocks` (el Plan) —
// invisibles hoy: un hábito activo sin ningún bloque, o un bloque que
// sigue apuntando a un hábito ya archivado. No hay caso de "actividad
// borrada": planBlockActivities tiene onDelete:cascade en ambos lados, así
// que borrar la actividad ya borra el link.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activities } from "@/lib/db/schema/habitos";
import { planBlockActivities, planBlocks } from "@/lib/db/schema/plan";

export type OrphanActivity = { id: string; name: string };

export type OrphanPlanBlock = {
  blockId: string;
  activityId: string;
  activityName: string;
  blockText: string;
  weekday: number;
  startTime: string;
};

// Un hábito/subhábito "está en el Plan" si ÉL MISMO o ALGÚN ANCESTRO suyo
// tiene fila en plan_block_activities — esa tabla solo enlaza el nivel 1
// (ver lib/plan/sub-habits.ts), así que un hijo/nieto de un hábito
// enlazado nunca tiene su propia fila, pero no es huérfano: cuelga del
// mismo bloque que su ancestro. Se excluyen los secundarios (is_optional)
// — no es un desajuste que uno no esté enlazado directo, es la idea — y
// los "vicios" (frequency=recurrente), que nunca pertenecen al Plan.
export async function getOrphanActivities(userId: string): Promise<OrphanActivity[]> {
  const all = await db
    .select({
      id: activities.id,
      name: activities.name,
      parentId: activities.parentId,
      isOptional: activities.isOptional,
      frequency: activities.frequency,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.isActive, true)));

  const linkedRows = await db
    .select({ activityId: planBlockActivities.activityId })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .where(eq(activities.userId, userId));
  const linkedIds = new Set(linkedRows.map((l) => l.activityId));

  const byId = new Map(all.map((a) => [a.id, a]));
  function hasLinkedAncestor(a: (typeof all)[number]): boolean {
    let cur: (typeof all)[number] | undefined = a;
    while (cur) {
      if (linkedIds.has(cur.id)) return true;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return false;
  }

  return all
    .filter((a) => !a.isOptional && a.frequency !== "recurrente" && !hasLinkedAncestor(a))
    .map((a) => ({ id: a.id, name: a.name }));
}

export async function getOrphanPlanBlocks(planId: string): Promise<OrphanPlanBlock[]> {
  const rows = await db
    .select({
      blockId: planBlocks.id,
      activityId: activities.id,
      activityName: activities.name,
      blockText: planBlocks.text,
      weekday: planBlocks.weekday,
      startTime: planBlocks.startTime,
    })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .innerJoin(planBlocks, eq(planBlocks.id, planBlockActivities.blockId))
    .where(and(eq(planBlocks.planId, planId), eq(activities.isActive, false)));
  return rows;
}
