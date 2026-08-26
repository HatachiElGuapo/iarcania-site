"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { people, importantDates } from "@/lib/db/schema/personas";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function syncBirthday(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  personId: string,
  name: string,
  relationship: string,
  day: number | null,
  month: number | null,
) {
  const [existing] = await tx
    .select()
    .from(importantDates)
    .where(eq(importantDates.personId, personId))
    .limit(1);

  if (day && month) {
    if (existing) {
      await tx
        .update(importantDates)
        .set({ name, day, month, relationship })
        .where(eq(importantDates.id, existing.id));
    } else {
      await tx.insert(importantDates).values({
        userId,
        personId,
        name,
        type: "cumpleanos",
        relationship,
        day,
        month,
      });
    }
  } else if (existing) {
    await tx.delete(importantDates).where(eq(importantDates.id, existing.id));
  }
}

export async function createPersona(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const relationship = String(formData.get("relationship") || "amigo");
  const notes = String(formData.get("notes") || "").trim() || null;
  const bdayDay = Number(formData.get("bdayDay")) || null;
  const bdayMonth = Number(formData.get("bdayMonth")) || null;

  if (!name) throw new Error("El nombre es obligatorio");

  await db.transaction(async (tx) => {
    const [person] = await tx
      .insert(people)
      .values({ userId, name, relationship, notes })
      .returning();
    await syncBirthday(tx, userId, person.id, name, relationship, bdayDay, bdayMonth);
  });

  revalidatePath("/dashboard/personas");
}

export async function updatePersona(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const relationship = String(formData.get("relationship") || "amigo");
  const notes = String(formData.get("notes") || "").trim() || null;
  const bdayDay = Number(formData.get("bdayDay")) || null;
  const bdayMonth = Number(formData.get("bdayMonth")) || null;

  if (!name) throw new Error("El nombre es obligatorio");

  await db.transaction(async (tx) => {
    await tx
      .update(people)
      .set({ name, relationship, notes })
      .where(and(eq(people.id, id), eq(people.userId, userId)));
    await syncBirthday(tx, userId, id, name, relationship, bdayDay, bdayMonth);
  });

  revalidatePath("/dashboard/personas");
}

export async function deletePersona(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)));

  revalidatePath("/dashboard/personas");
}

export async function createImportantDate(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "evento");
  const day = Number(formData.get("day"));
  const month = Number(formData.get("month"));

  if (!name) throw new Error("El nombre es obligatorio");
  if (!day || day < 1 || day > 31) throw new Error("Día inválido");
  if (!month || month < 1 || month > 12) throw new Error("Mes inválido");

  await db.insert(importantDates).values({ userId, name, type, day, month });

  revalidatePath("/dashboard/personas");
}

export async function deleteImportantDate(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(importantDates)
    .where(and(eq(importantDates.id, id), eq(importantDates.userId, userId)));

  revalidatePath("/dashboard/personas");
}
