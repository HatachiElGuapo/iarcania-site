"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks, dailyFocus, workNotes } from "@/lib/db/schema/trabajo";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

// createTask/toggleTaskStatus viven en actividades/actions.ts (Actividades es
// la vista de gestión completa de tasks) — se importan directo desde ahí en
// los page.tsx que las necesitan, en vez de duplicarlas aquí.

export async function addToWorkFocus(formData: FormData) {
  const userId = await requireUserId();
  const taskId = String(formData.get("taskId") || "");
  const date = String(formData.get("date") || "");
  if (!taskId) return;

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) throw new Error("Tarea no encontrada");

  await db
    .insert(dailyFocus)
    .values({ userId, date, listType: "trabajo", taskId })
    .onConflictDoNothing();

  revalidatePath("/dashboard/trabajo");
}

export async function toggleFocusComplete(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const nextCompleted = formData.get("nextCompleted") === "true";

  await db
    .update(dailyFocus)
    .set({ completed: nextCompleted })
    .where(and(eq(dailyFocus.id, id), eq(dailyFocus.userId, userId)));

  revalidatePath("/dashboard/trabajo");
}

export async function removeFromFocus(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(dailyFocus)
    .where(and(eq(dailyFocus.id, id), eq(dailyFocus.userId, userId)));

  revalidatePath("/dashboard/trabajo");
}

export async function createWorkNote(formData: FormData) {
  const userId = await requireUserId();
  const channel = String(formData.get("channel") || "");
  const content = String(formData.get("content") || "").trim();
  const date = String(formData.get("date") || "");

  if (!["iarcania", "voidstoic"].includes(channel)) {
    throw new Error("Canal inválido");
  }
  if (!content) throw new Error("La nota no puede estar vacía");

  await db.insert(workNotes).values({ userId, channel, content, date });

  revalidatePath("/dashboard/trabajo");
}
