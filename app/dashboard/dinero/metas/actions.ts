"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { purchaseGoals } from "@/lib/db/schema/metas";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createGoal(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price"));
  const priority = String(formData.get("priority") || "media");
  const targetDate = String(formData.get("targetDate") || "") || null;

  if (!name) throw new Error("El nombre de la meta es obligatorio");
  if (!price || price <= 0) throw new Error("Precio inválido");
  if (!["alta", "media", "baja"].includes(priority)) {
    throw new Error("Prioridad inválida");
  }

  await db.insert(purchaseGoals).values({
    userId,
    name,
    price,
    priority,
    targetDate,
  });

  revalidatePath("/dashboard/dinero/metas");
}

export async function toggleGoalDone(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const nextDone = formData.get("nextDone") === "true";

  await db
    .update(purchaseGoals)
    .set({ done: nextDone })
    .where(and(eq(purchaseGoals.id, id), eq(purchaseGoals.userId, userId)));

  revalidatePath("/dashboard/dinero/metas");
}

export async function deleteGoal(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(purchaseGoals)
    .where(and(eq(purchaseGoals.id, id), eq(purchaseGoals.userId, userId)));

  revalidatePath("/dashboard/dinero/metas");
}
