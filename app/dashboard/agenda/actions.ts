"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";
import { activities } from "@/lib/db/schema/habitos";
import { normalizeTime, normalizeDuration } from "./time";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createBlock(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockTime = String(formData.get("blockTime") || "");
  const itemType = String(formData.get("itemType") || "nota");
  const itemId = String(formData.get("itemId") || "") || null;
  const duration = Number(formData.get("duration")) || 20;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!date || !blockTime) throw new Error("Fecha y hora son obligatorias");
  if (!["task", "nota", "cita", "habito"].includes(itemType)) throw new Error("Tipo inválido");

  await db
    .insert(agendaItems)
    .values({ userId, date, blockTime, itemType, itemId, duration, notes })
    .onConflictDoNothing();

  revalidatePath("/dashboard/agenda");
}

export async function updateBlock(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const blockTime = String(formData.get("blockTime") || "");
  const duration = Number(formData.get("duration")) || 20;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!blockTime) throw new Error("La hora es obligatoria");

  await db
    .update(agendaItems)
    .set({ blockTime, duration, notes })
    .where(and(eq(agendaItems.id, id), eq(agendaItems.userId, userId)));

  revalidatePath("/dashboard/agenda");
}

export async function deleteBlock(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(agendaItems)
    .where(and(eq(agendaItems.id, id), eq(agendaItems.userId, userId)));

  revalidatePath("/dashboard/agenda");
}

// Reprogramar un bloque existente (arrastre, redimensión o botones rápidos).
// No toca notes ni item vinculado — solo hora y duración.
export async function moveBlock(input: { id: string; blockTime: string; duration: number }) {
  const userId = await requireUserId();
  if (!input?.id) throw new Error("Falta el bloque");

  await db
    .update(agendaItems)
    .set({ blockTime: normalizeTime(input.blockTime), duration: normalizeDuration(input.duration) })
    .where(and(eq(agendaItems.id, input.id), eq(agendaItems.userId, userId)));

  revalidatePath("/dashboard/agenda");
}

// Materializa un hábito de rutina diaria como bloque real para UN día concreto
// (al arrastrarlo o ajustarlo en la agenda). El resto de días sigue mostrando
// el hábito virtual en su hora_sugerida; la sección Hábitos no se toca.
export async function scheduleHabit(input: {
  activityId: string;
  date: string;
  blockTime: string;
  duration: number;
}) {
  const userId = await requireUserId();
  if (!input?.activityId || !input?.date) throw new Error("Datos incompletos");

  const [act] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, input.activityId), eq(activities.userId, userId)));
  if (!act) throw new Error("Hábito no encontrado");

  await db
    .insert(agendaItems)
    .values({
      userId,
      date: input.date,
      blockTime: normalizeTime(input.blockTime),
      itemId: input.activityId,
      itemType: "habito",
      duration: normalizeDuration(input.duration),
    })
    .onConflictDoNothing();

  revalidatePath("/dashboard/agenda");
}
