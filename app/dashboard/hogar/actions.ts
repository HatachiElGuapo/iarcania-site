"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { choreTypes, choreLogs } from "@/lib/db/schema/hogar";
import { nowHHMM } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createChoreType(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const allowMultiple = formData.get("allowMultiple") === "on";

  if (!name) throw new Error("El nombre es obligatorio");

  await db.insert(choreTypes).values({ userId, name, icon, allowMultiple });

  revalidatePath("/dashboard/hogar");
}

export async function logChoreDone(formData: FormData) {
  const userId = await requireUserId();
  const choreTypeId = String(formData.get("choreTypeId") || "");
  const date = String(formData.get("date") || "");
  const doneBy = String(formData.get("doneBy") || "").trim() || null;

  if (!choreTypeId || !date) throw new Error("Faltan datos");

  await db
    .insert(choreLogs)
    .values({ userId, choreTypeId, date, doneBy, doneAt: nowHHMM() });

  revalidatePath("/dashboard/hogar");
}

export async function updateChoreLog(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const doneAt = String(formData.get("doneAt") || "") || null;
  const durationMinutes = formData.get("durationMinutes")
    ? Number(formData.get("durationMinutes"))
    : null;

  await db
    .update(choreLogs)
    .set({ doneAt, durationMinutes })
    .where(and(eq(choreLogs.id, id), eq(choreLogs.userId, userId)));

  revalidatePath("/dashboard/hogar");
}

export async function deleteChoreLog(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(choreLogs).where(and(eq(choreLogs.id, id), eq(choreLogs.userId, userId)));

  revalidatePath("/dashboard/hogar");
}

export async function addChoreNote(formData: FormData) {
  const userId = await requireUserId();
  const choreTypeId = String(formData.get("choreTypeId") || "");
  const date = String(formData.get("date") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!notes) throw new Error("La nota no puede estar vacía");

  await db.insert(choreLogs).values({ userId, choreTypeId, date, notes });

  revalidatePath("/dashboard/hogar");
}
