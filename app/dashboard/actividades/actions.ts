"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";

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

export async function createTask(formData: FormData) {
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

  await db.insert(tasks).values({
    userId,
    title,
    category,
    priority,
    dueDate,
    timeDue,
    timeEnd,
    notes,
  });

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
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

export async function deleteTask(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trabajo/tareas");
}
