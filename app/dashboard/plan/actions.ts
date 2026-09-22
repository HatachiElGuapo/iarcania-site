"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { plans, planPeople, planBlocks, planChecks, planOverrides, planBlockActivities } from "@/lib/db/schema/plan";
import { activityLogs } from "@/lib/db/schema/habitos";
import { tasks } from "@/lib/db/schema/trabajo";
import { loadPlanContextForUser, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { addDaysISO } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

// Un plan es de la CASA, no de una sola persona: el dueño (plans.ownerId)
// puede marcar cualquier bloque, pero cada persona enlazada por su propia
// cuenta (planPeople.userId, ej. Diana) también tiene que poder marcar los
// bloques de SU columna — antes esto exigía ser el dueño del plan sin
// excepción, así que cualquiera que no fuera el dueño se encontraba con
// "Bloque no encontrado" al marcar lo que fuera, aunque el bloque existiera.
async function requireOwnedBlock(blockId: string, userId: string) {
  const [row] = await db
    .select({ id: planBlocks.id, planId: planBlocks.planId, personId: planBlocks.personId, ownerId: plans.ownerId })
    .from(planBlocks)
    .innerJoin(plans, eq(plans.id, planBlocks.planId))
    .where(eq(planBlocks.id, blockId));
  if (!row) throw new Error("Bloque no encontrado");
  if (row.ownerId === userId) return row;

  const [person] = await db
    .select({ id: planPeople.id })
    .from(planPeople)
    .where(and(eq(planPeople.id, row.personId), eq(planPeople.userId, userId)));
  if (!person) throw new Error("No autorizado para este bloque");
  return row;
}

// Un bloque de Plan puede tener uno o más hábitos enlazados
// (plan_block_activities) — la card "Hábitos" del dashboard (racha, franja
// de la semana) lee activity_logs, no plan_checks, así que sin esto marcar
// "hecho" en un bloque enlazado desde "Tu día"/Plan nunca hacía avanzar la
// racha de ese hábito. Mantiene los dos en sync: "hecho" asegura un log de
// hoy por cada hábito enlazado (sin duplicar si ya había uno), cualquier
// otro estado (saltado, o quitar la marca) lo borra.
async function syncLinkedHabitLogs(userId: string, blockId: string, date: string, done: boolean) {
  const links = await db
    .select({ activityId: planBlockActivities.activityId })
    .from(planBlockActivities)
    .where(eq(planBlockActivities.blockId, blockId));
  if (!links.length) return;
  const activityIds = links.map((l) => l.activityId);

  if (!done) {
    await db
      .delete(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), inArray(activityLogs.activityId, activityIds)));
    return;
  }

  const existing = await db
    .select({ activityId: activityLogs.activityId })
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), inArray(activityLogs.activityId, activityIds)));
  const alreadyLogged = new Set(existing.map((e) => e.activityId));
  const missing = activityIds.filter((id) => !alreadyLogged.has(id));
  if (missing.length) {
    await db.insert(activityLogs).values(missing.map((activityId) => ({ userId, activityId, date })));
  }
}

// Marca/desmarca un bloque para UN día — status vacío = quita la marca.
// resolved_text se calcula acá (con el resolver, sobre el plan completo) y
// queda fijo: si luego se reordena una cola o se edita el bloque, el
// historial no cambia.
export async function setCheck(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!date || !blockId) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);

  if (!status) {
    await db.delete(planChecks).where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));
    await syncLinkedHabitLogs(userId, blockId, date, false);
    revalidatePath("/dashboard/plan");
    revalidatePath("/dashboard/plan/historial");
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard");
    return;
  }
  if (status !== "done" && status !== "skipped") throw new Error("Estado inválido");

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) throw new Error("No hay plan");
  const [day] = resolvePlan(toPlanData(ctx), date, date);
  const resolved = day?.blocksByPerson[block.personId]?.find((b) => b.blockId === blockId);
  if (!resolved) throw new Error("El bloque no aplica ese día");

  await db
    .insert(planChecks)
    .values({
      planId: block.planId,
      date,
      blockId,
      personId: block.personId,
      status,
      resolvedText: resolved.text,
      note,
    })
    .onConflictDoUpdate({
      target: [planChecks.date, planChecks.blockId],
      set: { status, resolvedText: resolved.text, note, checkedAt: new Date() },
    });
  await syncLinkedHabitLogs(userId, blockId, date, status === "done");

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
}

// Cambia el texto de un bloque solo para ese día, sin tocar la plantilla.
export async function setOverride(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  const text = String(formData.get("text") || "").trim();
  if (!date || !blockId || !text) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date, blockId, text, removed: false })
    .onConflictDoUpdate({ target: [planOverrides.date, planOverrides.blockId], set: { text, removed: false } });

  revalidatePath("/dashboard/plan");
}

// Quita un bloque de un día concreto (no de la plantilla semanal).
export async function removeForDay(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  if (!date || !blockId) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date, blockId, text: null, removed: true })
    .onConflictDoUpdate({ target: [planOverrides.date, planOverrides.blockId], set: { removed: true } });

  revalidatePath("/dashboard/plan");
}

function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) throw new Error("Hora inválida");
  const total = Math.min(23 * 60 + 50, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
  const snapped = Math.round(total / 10) * 10;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function normalizeDuration(raw: number): number {
  return Math.min(24 * 60, Math.max(20, Math.round((raw || 20) / 10) * 10));
}

// Mueve o redimensiona un bloque de Plan SOLO ese día (arrastrar/estirar en
// Agenda) — al mover (mode="move") conserva la duración de la plantilla
// (si el bloque es abierto, ej. Dormir, sigue abierto en el horario nuevo);
// al redimensionar (mode="resize") la duración pasada queda fija ese día,
// aunque el bloque sea normalmente abierto.
export async function moveBlockForDay(input: {
  date: string;
  blockId: string;
  startTime: string;
  duration?: number;
  mode?: "move" | "resize";
}) {
  const userId = await requireUserId();
  if (!input?.date || !input?.blockId || !input?.startTime) throw new Error("Faltan datos");

  const [block] = await db
    .select({
      planId: planBlocks.planId,
      personId: planBlocks.personId,
      startTime: planBlocks.startTime,
      endTime: planBlocks.endTime,
      ownerId: plans.ownerId,
    })
    .from(planBlocks)
    .innerJoin(plans, eq(plans.id, planBlocks.planId))
    .where(eq(planBlocks.id, input.blockId));
  if (!block) throw new Error("Bloque no encontrado");
  if (block.ownerId !== userId) {
    const [person] = await db
      .select({ id: planPeople.id })
      .from(planPeople)
      .where(and(eq(planPeople.id, block.personId), eq(planPeople.userId, userId)));
    if (!person) throw new Error("No autorizado para este bloque");
  }

  const startTime = normalizeTime(input.startTime);
  const durationMinutes =
    input.mode === "resize"
      ? normalizeDuration(input.duration ?? 20)
      : block.endTime
        ? toMinutes(block.endTime) - toMinutes(block.startTime)
        : null;

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date: input.date, blockId: input.blockId, startTime, durationMinutes, removed: false })
    .onConflictDoUpdate({
      target: [planOverrides.date, planOverrides.blockId],
      set: { startTime, durationMinutes, removed: false },
    });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/agenda");
}

// Saca un bloque de Plan de HOY sin que se pierda: lo quita del día (como
// removeForDay) y lo deja como una tarea real con vencimiento mañana, para
// que aparezca en el "Mi día"/Hoy de mañana en vez de quedar como
// incumplido y desaparecer. `text` es el texto YA RESUELTO que se estaba
// mostrando (la cola pudo haber puesto cualquier cosa ahí) — lo manda quien
// llama porque ya lo tiene a mano al renderizar el bloque; recalcularlo acá
// significaría cargar el plan completo otra vez para lo mismo.
export async function moveBlockToTomorrow(input: { date: string; blockId: string; text: string }) {
  const userId = await requireUserId();
  if (!input?.date || !input?.blockId || !input?.text?.trim()) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(input.blockId, userId);

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date: input.date, blockId: input.blockId, text: null, removed: true })
    .onConflictDoUpdate({ target: [planOverrides.date, planOverrides.blockId], set: { removed: true } });

  await db.insert(tasks).values({ userId, title: input.text.trim(), dueDate: addDaysISO(input.date, 1) });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/actividades");
}

// Vuelve un bloque a lo que diga la plantilla ese día (quita el override).
export async function clearOverride(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  if (!date || !blockId) throw new Error("Faltan datos");

  await requireOwnedBlock(blockId, userId);

  await db.delete(planOverrides).where(and(eq(planOverrides.date, date), eq(planOverrides.blockId, blockId)));

  revalidatePath("/dashboard/plan");
}
