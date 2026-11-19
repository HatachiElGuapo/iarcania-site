// "Extras de hoy" de un bloque de Plan — tasks sueltas (due_date = ese
// día) enlazadas vía tasks.plan_block_id, para mostrarse adentro del
// árbol del bloque en vez de sueltas en Tu día. No cuentan para
// completar el bloque ni para la racha — son solo tasks normales.
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";

export type PlanExtra = {
  id: string;
  title: string;
  timeDue: string | null;
  timeEnd: string | null;
  done: boolean;
};

export async function getPlanExtrasByBlock(userId: string, date: string): Promise<Map<string, PlanExtra[]>> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      timeDue: tasks.timeDue,
      timeEnd: tasks.timeEnd,
      status: tasks.status,
      planBlockId: tasks.planBlockId,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, date), isNotNull(tasks.planBlockId), ne(tasks.status, "archivada")));

  const map = new Map<string, PlanExtra[]>();
  for (const r of rows) {
    const blockId = r.planBlockId as string;
    const list = map.get(blockId) ?? [];
    list.push({ id: r.id, title: r.title, timeDue: r.timeDue, timeEnd: r.timeEnd, done: r.status === "completada" });
    map.set(blockId, list);
  }
  for (const list of map.values()) list.sort((a, b) => (a.timeDue ?? "99:99").localeCompare(b.timeDue ?? "99:99"));
  return map;
}
