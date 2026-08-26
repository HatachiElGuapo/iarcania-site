"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/dashboard/habitos");
  revalidatePath("/dashboard/habitos/gestion");
  revalidatePath("/dashboard/habitos/rachas");
}

export async function createActivity(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const frequency = String(formData.get("frequency") || "diaria");
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  const sortOrder = Number(formData.get("sortOrder")) || 0;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!["diaria", "semanal", "mensual", "unica", "recurrente"].includes(frequency)) {
    throw new Error("Frecuencia inválida");
  }

  await db.insert(activities).values({
    userId,
    name,
    category,
    frequency,
    horaSugerida,
    sortOrder,
  });

  revalidateAll();
}

export async function updateActivity(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const frequency = String(formData.get("frequency") || "diaria");
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  const sortOrder = Number(formData.get("sortOrder")) || 0;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!["diaria", "semanal", "mensual", "unica", "recurrente"].includes(frequency)) {
    throw new Error("Frecuencia inválida");
  }

  await db
    .update(activities)
    .set({ name, category, frequency, horaSugerida, sortOrder })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
}

export async function archiveActivity(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(activities)
    .set({ isActive: false })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
}

export async function unarchiveActivity(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(activities)
    .set({ isActive: true })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
}

export async function deleteActivity(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
}

// Toggle simple: si hay algún log hoy para este hábito, lo borra (marca "no
// hecho"); si no hay ninguno, crea uno con value=1 (marca "hecho").
export async function toggleLogToday(formData: FormData) {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const date = String(formData.get("date") || "");

  const existing = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.activityId, activityId),
        eq(activityLogs.userId, userId),
        eq(activityLogs.date, date),
      ),
    );

  if (existing.length > 0) {
    await db.delete(activityLogs).where(
      and(
        eq(activityLogs.activityId, activityId),
        eq(activityLogs.userId, userId),
        eq(activityLogs.date, date),
      ),
    );
  } else {
    await db.insert(activityLogs).values({ userId, activityId, date });
  }

  revalidateAll();
}
