"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { meals, nutritionTargets } from "@/lib/db/schema/nutricion";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function saveMeal(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const mealType = String(formData.get("mealType") || "");
  const date = String(formData.get("date") || "");
  const location = String(formData.get("location") || "casa");
  const description =
    String(formData.get("description") || "").trim() || null;
  const calories = formData.get("calories")
    ? Number(formData.get("calories"))
    : null;
  const proteinG = formData.get("proteinG")
    ? Number(formData.get("proteinG"))
    : null;
  const carbsG = formData.get("carbsG")
    ? Number(formData.get("carbsG"))
    : null;
  const fatG = formData.get("fatG") ? Number(formData.get("fatG")) : null;

  if (!["desayuno", "almuerzo", "cena", "snack"].includes(mealType)) {
    throw new Error("Tipo de comida inválido");
  }
  if (!["casa", "fuera"].includes(location)) {
    throw new Error("Ubicación inválida");
  }

  if (id) {
    await db
      .update(meals)
      .set({ description, location, calories, proteinG, carbsG, fatG })
      .where(and(eq(meals.id, id), eq(meals.userId, userId)));
  } else {
    await db.insert(meals).values({
      userId,
      date,
      mealType,
      description,
      location,
      calories,
      proteinG,
      carbsG,
      fatG,
    });
  }

  revalidatePath("/dashboard/cuerpo/nutricion");
}

export async function deleteMeal(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await db
    .delete(meals)
    .where(and(eq(meals.id, id), eq(meals.userId, userId)));

  revalidatePath("/dashboard/cuerpo/nutricion");
}

export async function saveTargets(formData: FormData) {
  const userId = await requireUserId();
  const kcalTarget = Number(formData.get("kcalTarget")) || 2000;
  const protTarget = Number(formData.get("protTarget")) || 150;
  const carbTarget = Number(formData.get("carbTarget")) || 200;
  const fatTarget = Number(formData.get("fatTarget")) || 65;

  await db
    .insert(nutritionTargets)
    .values({ userId, kcalTarget, protTarget, carbTarget, fatTarget })
    .onConflictDoUpdate({
      target: nutritionTargets.userId,
      set: {
        kcalTarget,
        protTarget,
        carbTarget,
        fatTarget,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/dashboard/cuerpo/nutricion");
}
