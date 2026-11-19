// Lectura para la tarjeta "Acciones" del dashboard — las 3 principales
// de un día (via daily_focus, list_type='hoy') y las "otras" (cualquier
// otra task con esa due_date). Mismo camino que recomendó la auditoría:
// todo vive en `tasks` con due_date/time_due, daily_focus solo marca
// cuáles son las 3 principales.
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, dailyFocus } from "@/lib/db/schema/trabajo";

export type FocusSlot = {
  rank: number;
  taskId: string | null;
  title: string;
  timeDue: string | null;
  timeEnd: string | null;
  done: boolean;
};

export type OtherAction = {
  id: string;
  title: string;
  timeDue: string | null;
  timeEnd: string | null;
  done: boolean;
};

export async function getDailyActions(
  userId: string,
  date: string,
): Promise<{ focus: FocusSlot[]; others: OtherAction[] }> {
  const focusRows = await db
    .select({
      sortOrder: dailyFocus.sortOrder,
      taskId: dailyFocus.taskId,
      title: tasks.title,
      timeDue: tasks.timeDue,
      timeEnd: tasks.timeEnd,
      status: tasks.status,
    })
    .from(dailyFocus)
    .innerJoin(tasks, eq(tasks.id, dailyFocus.taskId))
    .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, date), eq(dailyFocus.listType, "hoy")));

  const focusTaskIds = new Set(focusRows.map((f) => f.taskId));
  const focus: FocusSlot[] = [0, 1, 2].map((rank) => {
    const row = focusRows.find((f) => f.sortOrder === rank);
    return row
      ? {
          rank,
          taskId: row.taskId,
          title: row.title,
          timeDue: row.timeDue,
          timeEnd: row.timeEnd,
          done: row.status === "completada",
        }
      : { rank, taskId: null, title: "", timeDue: null, timeEnd: null, done: false };
  });

  const allTasksOfDay = await db
    .select({ id: tasks.id, title: tasks.title, timeDue: tasks.timeDue, timeEnd: tasks.timeEnd, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, date), ne(tasks.status, "archivada")));

  const others: OtherAction[] = allTasksOfDay
    .filter((t) => !focusTaskIds.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, timeDue: t.timeDue, timeEnd: t.timeEnd, done: t.status === "completada" }))
    .sort((a, b) => (a.timeDue ?? "99:99").localeCompare(b.timeDue ?? "99:99"));

  return { focus, others };
}
