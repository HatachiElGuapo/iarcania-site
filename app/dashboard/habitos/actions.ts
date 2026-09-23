"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs, activityQueueItems } from "@/lib/db/schema/habitos";

const FREQUENCIES = ["diaria", "semanal", "mensual", "unica", "recurrente", "trabajo"];

function parseDiasSemana(formData: FormData): number[] | null {
  const raw = formData.getAll("diasSemana").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return raw.length ? raw.sort((a, b) => a - b) : null;
}

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/dashboard/habitos");
  revalidatePath("/dashboard/habitos/gestion");
  revalidatePath("/dashboard/habitos/rachas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

// Lectura para el panel de "Mi día" (<TaskHabitMenu>) — mismo motivo que
// getTaskDetail en actividades/actions.ts.
export async function getActivityDetail(id: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));
  return row ?? null;
}

// El log de HOY de este hábito, si existe — para precargar cantidad/nota
// en el panel ("hice 500 saltos", "medité 5 en vez de 20").
export async function getActivityLog(activityId: string, date: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(1);
  return row ?? null;
}

// Guarda cantidad/nota del log de HOY — si no hay log todavía (el hábito
// no estaba marcado), lo crea (equivale a marcarlo hecho). Si ya hay uno,
// lo actualiza en vez de sumar otro — a diferencia de incrementLog (para
// "recurrentes", donde cada click SÍ es una ocurrencia nueva), acá es un
// solo valor por día que se corrige, no se acumula.
export async function updateActivityLog(formData: FormData) {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const date = String(formData.get("date") || "");
  const rawValue = Number(formData.get("value"));
  const value = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 1;
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!activityId || !date) throw new Error("Faltan datos");

  const [existing] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(1);

  if (existing) {
    await db.update(activityLogs).set({ value, notes }).where(eq(activityLogs.id, existing.id));
  } else {
    await db.insert(activityLogs).values({ userId, activityId, date, value, notes });
  }

  revalidateAll();
}

export async function createActivity(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const frequency = String(formData.get("frequency") || "diaria");
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  const sortOrder = Number(formData.get("sortOrder")) || 0;
  const diasSemana = frequency === "trabajo" ? parseDiasSemana(formData) : null;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!FREQUENCIES.includes(frequency)) {
    throw new Error("Frecuencia inválida");
  }

  await db.insert(activities).values({
    userId,
    name,
    category,
    frequency,
    horaSugerida,
    sortOrder,
    diasSemana,
  });

  revalidateAll();
}

// Contenido persistente del hábito (activities.notes) — la "página" del
// hábito, para ir escribiendo/afinando algo sin fecha, distinto de la nota
// del día (activity_logs.notes, ver updateActivityLog).
export async function updateActivityContent(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const notes = String(formData.get("notes") || "");
  if (!id) throw new Error("Falta el hábito");

  await db
    .update(activities)
    .set({ notes: notes.trim() || null })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
  revalidatePath(`/dashboard/habitos/${id}`);
}

// Vincula/desvincula el guion de este hábito — ver <ScriptLinkPanel>.
export async function linkActivityScript(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const scriptId = String(formData.get("scriptId") || "") || null;
  if (!id) throw new Error("Falta el hábito");

  await db
    .update(activities)
    .set({ scriptId })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
  revalidatePath(`/dashboard/habitos/${id}`);
}

export async function updateActivity(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const frequency = String(formData.get("frequency") || "diaria");
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  const sortOrder = Number(formData.get("sortOrder")) || 0;
  const diasSemana = frequency === "trabajo" ? parseDiasSemana(formData) : null;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!FREQUENCIES.includes(frequency)) {
    throw new Error("Frecuencia inválida");
  }

  await db
    .update(activities)
    .set({ name, category, frequency, horaSugerida, sortOrder, diasSemana })
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  revalidateAll();
}

async function requireOwnedActivity(id: string, userId: string) {
  const [row] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));
  if (!row) throw new Error("Hábito no encontrado");
}

async function requireOwnedItem(id: string, userId: string) {
  const [row] = await db
    .select({
      id: activityQueueItems.id,
      activityId: activityQueueItems.activityId,
      position: activityQueueItems.position,
    })
    .from(activityQueueItems)
    .innerJoin(activities, eq(activities.id, activityQueueItems.activityId))
    .where(and(eq(activityQueueItems.id, id), eq(activities.userId, userId)));
  if (!row) throw new Error("Item no encontrado");
  return row;
}

// Agrega un item a la lista de una actividad "trabajo" (ej. un negocio más
// para contactar) — al final, sin tocar el resto.
export async function addActivityQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const text = String(formData.get("text") || "").trim();
  if (!text) throw new Error("Falta el texto del item");
  await requireOwnedActivity(activityId, userId);

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${activityQueueItems.position}), -1)` })
    .from(activityQueueItems)
    .where(eq(activityQueueItems.activityId, activityId));

  await db.insert(activityQueueItems).values({ activityId, position: Number(maxPos) + 1, text });
  revalidateAll();
  revalidatePath(`/dashboard/habitos/${activityId}`);
}

// Edita el texto, la nota y el guion/libro vinculado de UN item.
export async function updateActivityQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const item = await requireOwnedItem(id, userId);

  const text = String(formData.get("text") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const scriptId = String(formData.get("scriptId") || "") || null;
  const bookId = String(formData.get("bookId") || "") || null;
  if (!text) throw new Error("Falta el texto del item");

  await db.update(activityQueueItems).set({ text, notes, scriptId, bookId }).where(eq(activityQueueItems.id, id));
  revalidateAll();
  revalidatePath(`/dashboard/habitos/${item.activityId}`);
}

// Borra UN item y renumera los que quedan (0..n-1 contiguo) para que la
// posición (= veces cumplida % cantidad) siga siendo consistente.
export async function deleteActivityQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const item = await requireOwnedItem(id, userId);

  await db.transaction(async (tx) => {
    await tx.delete(activityQueueItems).where(eq(activityQueueItems.id, id));
    const siblings = await tx
      .select({ id: activityQueueItems.id })
      .from(activityQueueItems)
      .where(eq(activityQueueItems.activityId, item.activityId))
      .orderBy(asc(activityQueueItems.position));
    for (let i = 0; i < siblings.length; i++) {
      await tx.update(activityQueueItems).set({ position: i }).where(eq(activityQueueItems.id, siblings[i].id));
    }
  });
  revalidateAll();
  revalidatePath(`/dashboard/habitos/${item.activityId}`);
}

// Mueve un item un puesto arriba/abajo — intercambia posición con el vecino.
export async function moveActivityQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const direction = String(formData.get("direction") || "");
  const item = await requireOwnedItem(id, userId);

  const siblings = await db
    .select({ id: activityQueueItems.id, position: activityQueueItems.position })
    .from(activityQueueItems)
    .where(eq(activityQueueItems.activityId, item.activityId))
    .orderBy(asc(activityQueueItems.position));

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  await db.transaction(async (tx) => {
    await tx.update(activityQueueItems).set({ position: b.position }).where(eq(activityQueueItems.id, a.id));
    await tx.update(activityQueueItems).set({ position: a.position }).where(eq(activityQueueItems.id, b.id));
  });
  revalidateAll();
  revalidatePath(`/dashboard/habitos/${item.activityId}`);
}

// Cambiar solo la hora sugerida — updateActivity de arriba exige mandar
// todos los campos (nombre, categoría, frecuencia…) porque sobreescribe la
// fila entera; esto es lo que usa el panel de "Mi día", que solo tiene a
// mano la hora, no el resto del hábito.
export async function updateActivityTime(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  if (!id) throw new Error("Falta el hábito");

  await db
    .update(activities)
    .set({ horaSugerida })
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

// Contador (para "vicios" u otros hábitos frequency='recurrente'): cada
// click suma una fila nueva — el conteo del día es la cantidad de filas,
// no un booleano. decrementLog quita la última en vez de todo el día, para
// poder corregir un +1 de más sin perder el resto.
export async function incrementLog(formData: FormData) {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const date = String(formData.get("date") || "");
  if (!activityId || !date) throw new Error("Faltan datos");

  await db.insert(activityLogs).values({ userId, activityId, date });

  revalidateAll();
}

export async function decrementLog(formData: FormData) {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const date = String(formData.get("date") || "");
  if (!activityId || !date) throw new Error("Faltan datos");

  const [last] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(1);
  if (last) await db.delete(activityLogs).where(eq(activityLogs.id, last.id));

  revalidateAll();
}
