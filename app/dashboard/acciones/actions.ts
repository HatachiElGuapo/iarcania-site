"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks, dailyFocus } from "@/lib/db/schema/trabajo";
import { activities } from "@/lib/db/schema/habitos";
import { applyHabitToggle } from "@/app/dashboard/plan/actions";
import { addDaysISO, todayISO } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/plan");
}

// Si mañana (relativo a HOY real, no a la fecha que se esté mirando en el
// dashboard) tiene sus 3 acciones principales definidas, marca done — con
// la cascada completa de applyHabitToggle — el hábito "3 acciones de
// mañana" de HOY; si deja de tener las 3, lo desmarca. Si ese hábito
// todavía no existe (se crea a mano, como cualquier otro hábito), no hace
// nada — no es un error, simplemente no hay nada que sincronizar.
async function syncTomorrowActionsHabit(userId: string) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  const rows = await db
    .select({ sortOrder: dailyFocus.sortOrder })
    .from(dailyFocus)
    .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, tomorrow), eq(dailyFocus.listType, "hoy")));
  const allThreeDefined = new Set(rows.map((r) => r.sortOrder)).size >= 3;

  const [habit] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.name, "3 acciones de mañana"), eq(activities.isActive, true)));
  if (!habit) return;

  await applyHabitToggle(userId, habit.id, today, allThreeDefined);
}

// Guarda (o limpia, si `title` viene vacío) uno de los 3 campos fijos
// "Acción 1/2/3" de un día — crea/actualiza la task detrás y la fila de
// daily_focus (list_type='hoy', sort_order=rank 0/1/2) que la marca como
// principal, en vez de "otra acción" suelta. Al limpiar, borrar la task
// se lleva la fila de daily_focus sola (onDelete: cascade).
export async function saveFocusSlot(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const rank = Number(formData.get("rank"));
  const title = String(formData.get("title") || "").trim();
  const timeDue = String(formData.get("timeDue") || "") || null;
  if (!date || ![0, 1, 2].includes(rank)) throw new Error("Faltan datos");

  const [existing] = await db
    .select({ id: dailyFocus.id, taskId: dailyFocus.taskId })
    .from(dailyFocus)
    .where(
      and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.date, date),
        eq(dailyFocus.listType, "hoy"),
        eq(dailyFocus.sortOrder, rank),
      ),
    );

  if (!title) {
    if (existing) await db.delete(tasks).where(eq(tasks.id, existing.taskId));
  } else if (existing) {
    await db.update(tasks).set({ title, timeDue }).where(eq(tasks.id, existing.taskId));
  } else {
    const [task] = await db.insert(tasks).values({ userId, title, dueDate: date, timeDue }).returning({ id: tasks.id });
    await db.insert(dailyFocus).values({ userId, date, listType: "hoy", taskId: task.id, sortOrder: rank });
  }

  await syncTomorrowActionsHabit(userId);
  revalidateAll();
}
