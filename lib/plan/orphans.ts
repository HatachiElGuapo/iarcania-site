// Desajustes entre `activities` (hábitos) y `plan_blocks` (el Plan) —
// invisibles hoy: un hábito activo sin ningún bloque, o un bloque que
// sigue apuntando a un hábito ya archivado. No hay caso de "actividad
// borrada": planBlockActivities tiene onDelete:cascade en ambos lados, así
// que borrar la actividad ya borra el link.
import { and, eq, isNull } from "drizzle-orm";
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

export async function getOrphanActivities(userId: string): Promise<OrphanActivity[]> {
  const rows = await db
    .select({ id: activities.id, name: activities.name })
    .from(activities)
    .leftJoin(planBlockActivities, eq(planBlockActivities.activityId, activities.id))
    .where(and(eq(activities.userId, userId), eq(activities.isActive, true), isNull(planBlockActivities.blockId)));
  return rows;
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
