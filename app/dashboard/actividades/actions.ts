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
  revalidatePath("/dashboard/trabajo");
  revalidatePath("/dashboard/trabajo/tareas");
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
