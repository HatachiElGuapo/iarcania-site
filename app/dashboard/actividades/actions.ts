"use server";

import { revalidatePath } from "next/cache";
import { and, eq, lt, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { todayISO } from "@/lib/date/bogota";
import { withOriginalDateNote } from "@/lib/trabajo/reschedule";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

// Lectura para el panel de "Mi día" (<TaskHabitMenu>): antes "Ver detalle"
// mandaba a /dashboard/actividades, una lista general que no resalta ni
// muestra nada de ESA tarea puntual — pedido explícito de mostrar la info
// ahí mismo. No hay ruta de detalle por tarea todavía, así que el panel la
// pide y la pinta él mismo.
export async function getTaskDetail(id: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return row ?? null;
}

// Devuelve el id de la task recién creada — lo usa new-task-form.ts (ver
// app/dashboard/new-task-form.ts) para enlazarla a "Las 3 de hoy" con
// linkTaskToFocusSlot (acciones/actions.ts) en un segundo paso, cuando se
// marcó "Es una de mis 3 acciones". Los demás llamadores (QuickAddOther,
// NewTaskSheet viejo) ya ignoraban el valor devuelto, así que no rompe
// nada agregar el retorno.
export async function createTask(formData: FormData): Promise<{ id: string }> {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "") || null;
  const priority = String(formData.get("priority") || "media");
  const dueDate = String(formData.get("dueDate") || "") || null;
  const timeDue = String(formData.get("timeDue") || "") || null;
  const timeEnd = String(formData.get("timeEnd") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!title) throw new Error("El título de la tarea es obligatorio");
  if (!["alta", "media", "baja"].includes(priority)) {
    throw new Error("Prioridad inválida");
  }
  if (timeDue && timeEnd) {
    const [sh, sm] = timeDue.split(":").map(Number);
    const [eh, em] = timeEnd.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) throw new Error("La hora de fin debe ser mayor que la de inicio");
  }

  const [row] = await db
    .insert(tasks)
    .values({
      userId,
      title,
      category,
      priority,
      dueDate,
      timeDue,
      timeEnd,
      notes,
    })
    .returning({ id: tasks.id });

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
  return { id: row.id };
}

// Mismo createTask, sin el valor de retorno — para los <form action>/
// <QuickCapture> que no lo necesitan: TS no deja asignar una función que
// devuelve Promise<{id}> a una prop tipada `(fd) => void | Promise<void>`
// (esa laxitud de "función void acepta cualquier retorno" no atraviesa un
// Promise), así que estos sitios usan este wrapper en vez de createTask.
export async function createTaskForm(formData: FormData): Promise<void> {
  await createTask(formData);
}

// Cambiar la hora (y de paso la fecha, si hace falta) de una tarea ya
// creada — antes solo se podía fijar al crearla, no había forma de
// corregirla después.
export async function updateTaskSchedule(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const dueDate = String(formData.get("dueDate") || "") || null;
  const timeDue = String(formData.get("timeDue") || "") || null;
  if (!id) throw new Error("Falta la tarea");

  await db
    .update(tasks)
    .set({ dueDate, timeDue })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
}

// Guarda la nota de una tarea desde el panel de "Mi día" — antes solo se
// podía ver (getTaskDetail), no editar sin ir a Actividades.
export async function updateTaskNotes(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!id) throw new Error("Falta la tarea");

  await db.update(tasks).set({ notes }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
}

// Vincula/desvincula el guion de esta tarea — ver <ScriptLinkPanel>.
export async function linkTaskScript(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const scriptId = String(formData.get("scriptId") || "") || null;
  if (!id) throw new Error("Falta la tarea");

  await db
    .update(tasks)
    .set({ scriptId })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath(`/dashboard/actividades/${id}`);
  revalidatePath("/dashboard");
}

export async function toggleTaskStatus(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const nextStatus = String(formData.get("nextStatus") || "");

  if (!["pendiente", "completada"].includes(nextStatus)) {
    throw new Error("Estado inválido");
  }

  await db
    .update(tasks)
    .set({ status: nextStatus })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
}

export async function archiveTask(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(tasks)
    .set({ status: "archivada" })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
}

export async function unarchiveTask(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(tasks)
    .set({ status: "pendiente" })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
}

// Reagenda UNA tarea — "" en dueDate = sin fecha (backlog). Usado por el
// menú "Reagendar" de cada fila en /dashboard/actividades.
export async function rescheduleTask(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const dueDate = String(formData.get("dueDate") || "") || null;
  if (!id) throw new Error("Falta la tarea");

  const [task] = await db
    .select({ dueDate: tasks.dueDate, notes: tasks.notes })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (!task) throw new Error("Tarea no encontrada");

  const notes = withOriginalDateNote(task.notes, task.dueDate);
  await db.update(tasks).set({ dueDate, notes }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
}

// Reagenda TODAS las vencidas (mismo criterio que la pestaña "Vencidas":
// dueDate < hoy, no completada) de una sola — "Mover todas las vencidas
// a…" arriba de la lista.
export async function rescheduleOverdueTasks(formData: FormData) {
  const userId = await requireUserId();
  const dueDate = String(formData.get("dueDate") || "") || null;
  const today = todayISO();

  const overdue = await db
    .select({ id: tasks.id, dueDate: tasks.dueDate, notes: tasks.notes })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), lt(tasks.dueDate, today), ne(tasks.status, "completada")));

  await db.transaction(async (tx) => {
    for (const t of overdue) {
      const notes = withOriginalDateNote(t.notes, t.dueDate);
      await tx.update(tasks).set({ dueDate, notes }).where(eq(tasks.id, t.id));
    }
  });

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
}

export async function deleteTask(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/trabajo/tareas");
}
