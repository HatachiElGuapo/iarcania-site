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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Si hay inicio pero no fin, el cliente ya propone fin = inicio + 1h
// (editable) antes de guardar — esto es solo el resguardo del lado del
// servidor: fin, si viene, tiene que ser estrictamente mayor que inicio.
function validateRange(timeDue: string | null, timeEnd: string | null) {
  if (timeDue && timeEnd && toMinutes(timeEnd) <= toMinutes(timeDue)) {
    throw new Error("La hora de fin debe ser mayor que la de inicio");
  }
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
  const timeEnd = String(formData.get("timeEnd") || "") || null;
  if (!date || ![0, 1, 2].includes(rank)) throw new Error("Faltan datos");
  validateRange(timeDue, timeEnd);

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
    await db.update(tasks).set({ title, timeDue, timeEnd }).where(eq(tasks.id, existing.taskId));
  } else {
    const [task] = await db
      .insert(tasks)
      .values({ userId, title, dueDate: date, timeDue, timeEnd })
      .returning({ id: tasks.id });
    await db.insert(dailyFocus).values({ userId, date, listType: "hoy", taskId: task.id, sortOrder: rank });
  }

  await syncTomorrowActionsHabit(userId);
  revalidateAll();
}

// Qué posiciones (0/1/2 = "Acción 1/2/3") ya están ocupadas en un día —
// para el selector "Es una de mis 3 acciones" de NewTaskPanel/NewTaskSheet
// (new-task-form.ts), que necesita saber en vivo cuáles quedan libres
// para la fecha que se vaya eligiendo ahí (Hoy/Mañana/otra).
export async function getFocusAvailability(date: string): Promise<{ rank: number; title: string }[]> {
  const userId = await requireUserId();
  if (!date) return [];
  const rows = await db
    .select({ sortOrder: dailyFocus.sortOrder, title: tasks.title })
    .from(dailyFocus)
    .innerJoin(tasks, eq(tasks.id, dailyFocus.taskId))
    .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, date), eq(dailyFocus.listType, "hoy")));
  return rows.map((r) => ({ rank: r.sortOrder, title: r.title }));
}

// Enlaza una task YA CREADA (ver createTask en actividades/actions.ts) a
// una posición libre de "Las 3 de hoy" de un día — usado por el selector
// "Es una de mis 3 acciones" al crear una tarea nueva, en vez de crear la
// task de cero como hace saveFocusSlot (ahí el título llega vacío, acá ya
// existe). Falla si esa posición ya está ocupada — el cliente ya la
// revisó con getFocusAvailability, esto es el resguardo final contra una
// carrera entre pestañas.
export async function linkTaskToFocusSlot(input: { date: string; rank: number; taskId: string }): Promise<void> {
  const userId = await requireUserId();
  const { date, rank, taskId } = input;
  if (!date || ![0, 1, 2].includes(rank) || !taskId) throw new Error("Faltan datos");

  const [owned] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (!owned) throw new Error("Tarea no encontrada");

  const [existing] = await db
    .select({ id: dailyFocus.id })
    .from(dailyFocus)
    .where(
      and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.date, date),
        eq(dailyFocus.listType, "hoy"),
        eq(dailyFocus.sortOrder, rank),
      ),
    );
  if (existing) throw new Error(`Acción ${rank + 1} ya está ocupada`);

  await db.insert(dailyFocus).values({ userId, date, listType: "hoy", taskId, sortOrder: rank });
  await syncTomorrowActionsHabit(userId);
  revalidateAll();
}

// "Quitar de mis acciones" del menú ⋯ (FocusSlotMenu) — desenlaza SOLO la
// fila de daily_focus, la task sigue existiendo con su due_date intacto
// (pasa a verse como "otra acción" suelta, no una de las 3 principales).
// Deshacer es volver a enlazarla: mismo taskId/date/rank, por eso el
// "Deshacer" del toast llama a linkTaskToFocusSlot con estos mismos datos.
export async function unlinkFocusSlot(input: { date: string; rank: number; taskId: string }): Promise<void> {
  const userId = await requireUserId();
  const { date, rank, taskId } = input;
  if (!date || ![0, 1, 2].includes(rank) || !taskId) throw new Error("Faltan datos");

  await db
    .delete(dailyFocus)
    .where(
      and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.date, date),
        eq(dailyFocus.listType, "hoy"),
        eq(dailyFocus.sortOrder, rank),
        eq(dailyFocus.taskId, taskId),
      ),
    );

  await syncTomorrowActionsHabit(userId);
  revalidateAll();
}

// "Mover a mañana" del menú ⋯ — mueve la task (due_date) Y su fila de
// daily_focus un día después de `date` (la fecha de ESE slot, no
// necesariamente HOY), conservando la misma posición (rank). Falla si esa
// posición ya está ocupada mañana — no pisa otra acción.
export async function moveFocusSlotToTomorrow(input: { date: string; rank: number; taskId: string }): Promise<void> {
  const userId = await requireUserId();
  const { date, rank, taskId } = input;
  if (!date || ![0, 1, 2].includes(rank) || !taskId) throw new Error("Faltan datos");

  const tomorrow = addDaysISO(date, 1);
  const [occupiedTomorrow] = await db
    .select({ id: dailyFocus.id })
    .from(dailyFocus)
    .where(
      and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.date, tomorrow),
        eq(dailyFocus.listType, "hoy"),
        eq(dailyFocus.sortOrder, rank),
      ),
    );
  if (occupiedTomorrow) throw new Error(`Mañana, Acción ${rank + 1} ya está ocupada`);

  await db.update(tasks).set({ dueDate: tomorrow }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  await db
    .update(dailyFocus)
    .set({ date: tomorrow })
    .where(
      and(
        eq(dailyFocus.userId, userId),
        eq(dailyFocus.date, date),
        eq(dailyFocus.listType, "hoy"),
        eq(dailyFocus.sortOrder, rank),
        eq(dailyFocus.taskId, taskId),
      ),
    );

  await syncTomorrowActionsHabit(userId);
  revalidateAll();
}
