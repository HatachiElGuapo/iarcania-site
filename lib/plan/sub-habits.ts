// Árbol de hábitos de un Plan, hasta 3 niveles: nivel 1 = lo enlazado en
// plan_block_activities (TODOS, incluido el que comparte nombre con el
// bloque — antes se ocultaba, ya no), nivel 2/3 = descubiertos subiendo
// activities.parent_id. Reemplaza la lógica duplicada que había en
// app/dashboard/plan/page.tsx y lib/agenda/day-events.ts.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { planBlockActivities, planBlocks } from "@/lib/db/schema/plan";

export type HabitNode = {
  activityId: string;
  name: string;
  isOptional: boolean;
  done: boolean;
  children: HabitNode[];
};

type Row = { id: string; parentId: string | null; name: string; isOptional: boolean; sortOrder: number };

// sort_order ascendente, nombre como desempate — mismo criterio en los 3
// niveles.
function bySortOrder(a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

export async function loadHabitTreesByBlock(
  planId: string,
  userId: string,
  date: string,
): Promise<Map<string, HabitNode[]>> {
  const level1Rows = await db
    .select({
      blockId: planBlockActivities.blockId,
      id: activities.id,
      name: activities.name,
      isOptional: activities.isOptional,
      sortOrder: activities.sortOrder,
    })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .innerJoin(planBlocks, eq(planBlocks.id, planBlockActivities.blockId))
    .where(and(eq(planBlocks.planId, planId), eq(activities.isActive, true)));

  const level1Ids = level1Rows.map((r) => r.id);
  const level2Rows: Row[] = level1Ids.length
    ? await db
        .select({
          id: activities.id,
          parentId: activities.parentId,
          name: activities.name,
          isOptional: activities.isOptional,
          sortOrder: activities.sortOrder,
        })
        .from(activities)
        .where(and(inArray(activities.parentId, level1Ids), eq(activities.isActive, true)))
    : [];

  const level2Ids = level2Rows.map((r) => r.id);
  const level3Rows: Row[] = level2Ids.length
    ? await db
        .select({
          id: activities.id,
          parentId: activities.parentId,
          name: activities.name,
          isOptional: activities.isOptional,
          sortOrder: activities.sortOrder,
        })
        .from(activities)
        .where(and(inArray(activities.parentId, level2Ids), eq(activities.isActive, true)))
    : [];

  const allIds = [...level1Ids, ...level2Ids, ...level3Rows.map((r) => r.id)];
  const doneLogs = allIds.length
    ? await db
        .select({ activityId: activityLogs.activityId })
        .from(activityLogs)
        .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), inArray(activityLogs.activityId, allIds)))
    : [];
  const doneSet = new Set(doneLogs.map((l) => l.activityId));

  const childrenByParent = new Map<string, Row[]>();
  for (const r of [...level2Rows, ...level3Rows]) {
    if (!r.parentId) continue;
    const list = childrenByParent.get(r.parentId) ?? [];
    list.push(r);
    childrenByParent.set(r.parentId, list);
  }
  for (const list of childrenByParent.values()) list.sort(bySortOrder);

  // done de un nodo = tiene su propio log ESE día, O (tiene hijos Y todos
  // sus hijos done) — misma regla en los 3 niveles. El checkbox de un
  // padre siempre marca/desmarca SU PROPIO log (toggleLogToday sobre su
  // activityId) — nunca cascada hacia los hijos; "también se puede marcar
  // directo" es justamente ese camino independiente del cómputo por hijos.
  function buildNode(id: string, name: string, isOptional: boolean): HabitNode {
    const childRows = childrenByParent.get(id) ?? [];
    const children = childRows.map((c) => buildNode(c.id, c.name, c.isOptional));
    const done = doneSet.has(id) || (children.length > 0 && children.every((c) => c.done));
    return { activityId: id, name, isOptional, done, children };
  }

  const sortedLevel1Rows = [...level1Rows].sort(bySortOrder);

  const byBlock = new Map<string, HabitNode[]>();
  for (const r of sortedLevel1Rows) {
    const list = byBlock.get(r.blockId) ?? [];
    list.push(buildNode(r.id, r.name, r.isOptional));
    byBlock.set(r.blockId, list);
  }
  return byBlock;
}
