"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";

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
  if (!["task", "nota"].includes(itemType)) throw new Error("Tipo inválido");

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
