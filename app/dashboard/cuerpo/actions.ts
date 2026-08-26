"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { exercises, workoutLogs, bodyMetrics } from "@/lib/db/schema/cuerpo";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createExercise(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "");
  const muscleGroup = String(formData.get("muscleGroup") || "").trim();

  if (!name) throw new Error("El nombre del ejercicio es obligatorio");
  if (!["fuerza", "cardio", "peso_corporal"].includes(type)) {
    throw new Error("Tipo de ejercicio inválido");
  }

  await db.insert(exercises).values({
    userId,
    name,
    type,
    muscleGroup: muscleGroup || null,
  });

  revalidatePath("/dashboard/cuerpo");
}

export async function logSet(formData: FormData) {
  const userId = await requireUserId();
  const exerciseId = String(formData.get("exerciseId") || "");
  const date = String(formData.get("date") || "");

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
    .limit(1);

  if (!exercise) throw new Error("Ejercicio no encontrado");

  const reps = formData.get("reps") ? Number(formData.get("reps")) : null;
  const weight = formData.get("weight")
    ? Number(formData.get("weight"))
    : null;
  const durationMin = formData.get("durationMin")
    ? Number(formData.get("durationMin"))
    : null;
  const distanceKm = formData.get("distanceKm")
    ? Number(formData.get("distanceKm"))
    : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  let setNumber: number | null = null;
  if (exercise.type !== "cardio") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          eq(workoutLogs.exerciseId, exerciseId),
          eq(workoutLogs.date, date),
        ),
      );
    setNumber = count + 1;
  }

  await db.insert(workoutLogs).values({
    userId,
    exerciseId,
    date,
    setNumber,
    reps,
    weight,
    durationMin,
    distanceKm,
    notes,
  });

  revalidatePath("/dashboard/cuerpo");
}

export async function upsertBodyMetrics(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");

  const weightKg = formData.get("weightKg")
    ? Number(formData.get("weightKg"))
    : null;
  const sleepHours = formData.get("sleepHours")
    ? Number(formData.get("sleepHours"))
    : null;
  const bodyFatPct = formData.get("bodyFatPct")
    ? Number(formData.get("bodyFatPct"))
    : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  await db
    .insert(bodyMetrics)
    .values({ userId, date, weightKg, sleepHours, bodyFatPct, notes })
    .onConflictDoUpdate({
      target: [bodyMetrics.userId, bodyMetrics.date],
      set: { weightKg, sleepHours, bodyFatPct, notes },
    });

  revalidatePath("/dashboard/cuerpo");
}
