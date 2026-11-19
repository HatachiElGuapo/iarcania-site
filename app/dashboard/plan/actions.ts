"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, lte, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  plans,
  planPeople,
  planBlocks,
  planChecks,
  planOverrides,
  planBlockActivities,
  planQueues,
  planQueueItems,
  planQueueCursors,
  planPhases,
} from "@/lib/db/schema/plan";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { tasks } from "@/lib/db/schema/trabajo";
import { loadPlanContextForUser, toPlanData, findPlanPersonForUser } from "@/lib/plan/load";
import { resolvePlan, type PlanData } from "@/lib/plan/resolve";
import { getStreakForPerson } from "@/lib/plan/streak";
import {
  pickBlockPraise,
  streakMilestoneCrossed,
  pickStreakMilestoneMessage,
  pickProtectorGainedMessage,
} from "@/lib/plan/praise";
import { addDaysISO, weekdayMon0, todayISO, nowHHMM } from "@/lib/date/bogota";

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
export async function requireOwnedBlock(blockId: string, userId: string) {
  const [row] = await db
    .select({
      id: planBlocks.id,
      planId: planBlocks.planId,
      personId: planBlocks.personId,
      queueId: planBlocks.queueId,
      weekday: planBlocks.weekday,
      holidayText: planBlocks.holidayText,
      text: planBlocks.text,
      isMinimum: planBlocks.isMinimum,
      ownerId: plans.ownerId,
    })
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

// Un override/check solo tiene sentido en una fecha cuyo weekday coincida
// con el del bloque — el resolver solo evalúa overrides para bloques del
// weekday de ESE día (ver resolve.ts), así que guardar uno con otra fecha
// deja una fila muerta que nunca se aplica. Se vio un caso real: un bloque
// del lunes con un override guardado en 2026-10-20 (martes) — probablemente
// al mover un bloque ya pasada la medianoche, cuando la fecha "de hoy" en
// el cliente ya rotó pero el bloque seguía siendo el de ayer.
function assertDateMatchesWeekday(date: string, weekday: number) {
  if (weekdayMon0(date) !== weekday) {
    throw new Error("La fecha no coincide con el día del bloque");
  }
}

// El check de HOY de este bloque, si existe — para que el panel sepa el
// estado real (hecho/saltado/nada) en vez de asumirlo, y para precargar la
// nota ("medité 5 en vez de 20").
export async function getPlanCheck(input: { blockId: string; date: string }) {
  const userId = await requireUserId();
  await requireOwnedBlock(input.blockId, userId);
  const [row] = await db
    .select()
    .from(planChecks)
    .where(and(eq(planChecks.blockId, input.blockId), eq(planChecks.date, input.date)));
  return row ?? null;
}

// Bloque completo (para la página de detalle /dashboard/plan/bloque/[id]) —
// incluye notes, el contenido persistente del bloque (distinto de la nota
// del día en plan_checks.note).
export async function getBlockDetail(blockId: string) {
  const userId = await requireUserId();
  await requireOwnedBlock(blockId, userId);
  const [row] = await db.select().from(planBlocks).where(eq(planBlocks.id, blockId));
  return row ?? null;
}

// Guarda el contenido persistente del bloque — la "página" del bloque, para
// ir escribiendo/afinando algo sin fecha (ej. el guion de un bloque de
// contenido), distinto de la nota del día (plan_checks.note, ver setCheck).
export async function updateBlockContent(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const notes = String(formData.get("notes") || "");
  if (!id) throw new Error("Falta el bloque");

  await requireOwnedBlock(id, userId);
  await db
    .update(planBlocks)
    .set({ notes: notes.trim() || null })
    .where(eq(planBlocks.id, id));

  revalidatePath("/dashboard/plan");
  revalidatePath(`/dashboard/plan/bloque/${id}`);
}

// Vincula/desvincula el guion de este bloque — ver <ScriptLinkPanel>.
export async function linkBlockScript(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const scriptId = String(formData.get("scriptId") || "") || null;
  if (!id) throw new Error("Falta el bloque");

  await requireOwnedBlock(id, userId);
  await db
    .update(planBlocks)
    .set({ scriptId })
    .where(eq(planBlocks.id, id));

  revalidatePath("/dashboard/plan");
  revalidatePath(`/dashboard/plan/bloque/${id}`);
}

// Sube/baja el árbol de hábitos (activities.parent_id) DENTRO de una
// transacción ya abierta — usados tanto por applyBlockCheck (marcar el
// bloque cascada hacia TODOS sus hábitos) como por applyHabitToggle
// (marcar un hábito cascada hacia sus descendientes y hacia el/los
// bloque(s) que enlazan su ancestro de primer nivel).
async function collectDescendantIdsTx(tx: DbTx, activityId: string): Promise<string[]> {
  const children = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.parentId, activityId), eq(activities.isActive, true)));
  let ids = children.map((c) => c.id);
  for (const c of children) ids = ids.concat(await collectDescendantIdsTx(tx, c.id));
  return ids;
}

// done de una activity ese día = tiene su propio log, O (tiene hijos
// activos Y todos ellos están done) — misma regla recursiva que
// lib/plan/sub-habits.ts, pero leyendo DENTRO de la transacción (así ve
// los logs que la misma transacción ya escribió, no una copia vieja).
async function isActivityDoneOnDateTx(tx: DbTx, userId: string, activityId: string, date: string): Promise<boolean> {
  const [log] = await tx
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, userId), eq(activityLogs.activityId, activityId), eq(activityLogs.date, date)));
  if (log) return true;

  const children = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.parentId, activityId), eq(activities.isActive, true)));
  if (children.length === 0) return false;

  const results = await Promise.all(children.map((c) => isActivityDoneOnDateTx(tx, userId, c.id, date)));
  return results.every(Boolean);
}

async function setLogsForIdsTx(tx: DbTx, userId: string, ids: string[], date: string, done: boolean) {
  if (ids.length === 0) return;
  if (done) {
    const existing = await tx
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), inArray(activityLogs.activityId, ids)));
    const existingSet = new Set(existing.map((e) => e.activityId));
    const toInsert = ids.filter((id) => !existingSet.has(id));
    if (toInsert.length) await tx.insert(activityLogs).values(toInsert.map((id) => ({ userId, activityId: id, date })));
  } else {
    await tx
      .delete(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), inArray(activityLogs.activityId, ids)));
  }
}

// Cascada hacia abajo desde el bloque: TODOS sus hábitos de primer nivel
// (incluidos los secundarios) y toda su descendencia — pedido explícito:
// marcar/desmarcar el bloque marca/desmarca todo lo que enlaza.
async function cascadeBlockHabitsTx(tx: DbTx, userId: string, blockId: string, date: string, done: boolean) {
  const level1 = await tx
    .select({ id: activities.id })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .where(and(eq(planBlockActivities.blockId, blockId), eq(activities.isActive, true)));
  let ids = level1.map((a) => a.id);
  for (const a of level1) ids = ids.concat(await collectDescendantIdsTx(tx, a.id));
  await setLogsForIdsTx(tx, userId, ids, date, done);
}

// Escribe/borra el plan_check de un bloque dentro de una transacción ya
// abierta — lógica compartida entre el click manual (applyBlockCheck) y el
// auto-check/auto-desmarque que dispara el árbol de hábitos
// (applyHabitToggle). status vacío = quita la marca.
async function writeBlockCheckTx(
  tx: DbTx,
  block: { planId: string; personId: string },
  blockId: string,
  date: string,
  status: "" | "done" | "skipped",
  note: string | null,
  resolvedText: string,
) {
  const [existed] = await tx
    .select({ blockId: planChecks.blockId })
    .from(planChecks)
    .where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));

  if (!status) {
    await tx.delete(planChecks).where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));
    if (existed) await shiftQueueCursor(tx, blockId, date, -1);
    return;
  }

  await tx
    .insert(planChecks)
    .values({ planId: block.planId, date, blockId, personId: block.personId, status, resolvedText, note })
    .onConflictDoUpdate({
      target: [planChecks.date, planChecks.blockId],
      set: { status, resolvedText, note, checkedAt: new Date() },
    });
  if (!existed) await shiftQueueCursor(tx, blockId, date, 1);
}

// "Todos los mínimos del día de esta persona están done" — para el toast
// de "día cumplido" de Plan. Se usa tanto al marcar el bloque a mano como
// al completarlo solo desde el árbol de hábitos.
async function allMinimumsDoneForPerson(planData: PlanData, personId: string, date: string): Promise<boolean> {
  const [day] = resolvePlan(planData, date, date);
  const minimums = day?.blocksByPerson[personId]?.filter((b) => b.isMinimum) ?? [];
  if (minimums.length === 0) return false;
  const doneChecks = await db
    .select({ blockId: planChecks.blockId })
    .from(planChecks)
    .where(and(eq(planChecks.date, date), eq(planChecks.personId, personId), eq(planChecks.status, "done")));
  const doneIds = new Set(doneChecks.map((c) => c.blockId));
  return minimums.every((b) => doneIds.has(b.blockId));
}

// Sube la cadena activities.parent_id hasta el ancestro de primer nivel
// (el único que puede estar enlazado en plan_block_activities) — máximo 3
// niveles, así que 2 saltos alcanzan, pero se deja margen.
async function findTopAncestorId(activityId: string): Promise<string> {
  let current = activityId;
  for (let i = 0; i < 5; i++) {
    const [row] = await db.select({ parentId: activities.parentId }).from(activities).where(eq(activities.id, current));
    if (!row?.parentId) return current;
    current = row.parentId;
  }
  return current;
}

// La cola solo avanza cuando SE MARCA una actividad (hecho o saltado) —
// pedido explícito: si un día no se marca nada, al día siguiente sigue
// tocando la misma. El cursor vive en plan_queue_cursors, agrupado igual
// que plan_queue_items (phaseId null = cola global). `delta` +1 al marcar
// por primera vez, -1 al desmarcar (simétrico, reversible) — setCheck es
// quien decide cuándo llamar esto.
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function shiftQueueCursor(tx: DbTx, blockId: string, date: string, delta: number) {
  const [block] = await tx.select({ queueId: planBlocks.queueId }).from(planBlocks).where(eq(planBlocks.id, blockId));
  if (!block?.queueId) return;

  const [queue] = await tx
    .select({ id: planQueues.id, global: planQueues.global })
    .from(planQueues)
    .where(eq(planQueues.id, block.queueId));
  if (!queue) return;

  let phaseId: string | null = null;
  if (!queue.global) {
    const [phase] = await tx
      .select({ id: planPhases.id })
      .from(planPhases)
      .where(and(lte(planPhases.startDate, date), gte(planPhases.endDate, date)));
    phaseId = phase?.id ?? null;
  }

  const groupFilter = phaseId
    ? and(eq(planQueueCursors.queueId, queue.id), eq(planQueueCursors.phaseId, phaseId))
    : and(eq(planQueueCursors.queueId, queue.id), isNull(planQueueCursors.phaseId));

  const [existing] = await tx.select({ position: planQueueCursors.position }).from(planQueueCursors).where(groupFilter);
  const next = Math.max(0, (existing?.position ?? 0) + delta);

  if (existing) {
    await tx.update(planQueueCursors).set({ position: next }).where(groupFilter);
  } else if (next > 0) {
    await tx.insert(planQueueCursors).values({ queueId: queue.id, phaseId, position: next });
  }
}

// Resuelve en qué fecha vive REALMENTE este bloque para `date`: el caso
// normal es `date` mismo, pero un bloque que cruza la medianoche (sin
// end_time, ej. "Dormir" 21:00, o CON end_time menor al start_time, ej.
// 21:00–04:40) se sigue viendo y marcando desde la vista del día SIGUIENTE
// (day-events.ts lo "carga" como carry-over) — su check real pertenece al
// día en que empezó. Marcar desde el día siguiente solo es válido ANTES de
// que pase su end_time (si lo tiene) — después de esa hora esa ocurrencia
// ya venció. Si ni `date` ni `date - 1` resuelven el bloque, no hay fecha
// válida: null (quien llama decide qué hacer con eso).
function resolveEffectiveDate(
  planData: PlanData,
  personId: string,
  blockId: string,
  date: string,
  now: string,
): string | null {
  const [day] = resolvePlan(planData, date, date);
  if (day?.blocksByPerson[personId]?.some((b) => b.blockId === blockId)) return date;

  const yesterday = addDaysISO(date, -1);
  const [prevDay] = resolvePlan(planData, yesterday, yesterday);
  const prevBlock = prevDay?.blocksByPerson[personId]?.find((b) => b.blockId === blockId);
  if (prevBlock) {
    const crossesMidnight = !prevBlock.endTime || prevBlock.endTime < prevBlock.startTime;
    if (crossesMidnight && (!prevBlock.endTime || now < prevBlock.endTime)) return yesterday;
  }

  return null;
}

export type SetCheckResult = {
  done: boolean;
  isMinimum: boolean;
  allMinimumsDone: boolean;
  streakBefore: number;
  streakAfter: number;
  protectorsBefore: number;
  protectorsAfter: number;
};

// Marca/desmarca un bloque para UN día — status vacío = quita la marca.
// `setCheck` es el wrapper que recibe el FormData de un <form>/
// SafeActionButton; `applyBlockCheck` es la lógica de verdad, reusable sin
// pasar por FormData (la llama applyHabitToggle cuando el árbol de hábitos
// completa o descompleta el bloque solo — ver más abajo).
export async function setCheck(formData: FormData): Promise<SetCheckResult | undefined> {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!date || !blockId) throw new Error("Faltan datos");
  return applyBlockCheck(userId, blockId, date, status, note);
}

// resolved_text se calcula acá (con el resolver, sobre el plan completo) y
// queda fijo: si luego se reordena una cola o se edita el bloque, el
// historial no cambia. Devuelve info para que el cliente (SafeActionButton)
// decida un toast de felicitación/racha — undefined al desmarcar (no hay
// nada que festejar). Lanza "El bloque no aplica ese día" si `date` no
// resuelve ninguna fecha válida — el cliente lo atrapa y lo muestra como
// toast, no tumba la página.
export async function applyBlockCheck(
  userId: string,
  blockId: string,
  date: string,
  status: string,
  note: string | null,
): Promise<SetCheckResult | undefined> {
  const block = await requireOwnedBlock(blockId, userId);

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) throw new Error("No hay plan");
  const planData = toPlanData(ctx);

  const effectiveDate = resolveEffectiveDate(planData, block.personId, blockId, date, nowHHMM());
  if (!effectiveDate) throw new Error("El bloque no aplica ese día");

  if (!status) {
    await db.transaction(async (tx) => {
      await writeBlockCheckTx(tx, block, blockId, effectiveDate, "", null, "");
      await cascadeBlockHabitsTx(tx, userId, blockId, effectiveDate, false);
    });
    revalidatePath("/dashboard/plan");
    revalidatePath("/dashboard/plan/historial");
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard");
    return undefined;
  }
  if (status !== "done" && status !== "skipped") throw new Error("Estado inválido");

  const [day] = resolvePlan(planData, effectiveDate, effectiveDate);
  const resolved = day?.blocksByPerson[block.personId]?.find((b) => b.blockId === blockId);
  if (!resolved) throw new Error("El bloque no aplica ese día");

  const streakBeforeResult = block.isMinimum
    ? await getStreakForPerson(ctx, block.personId, effectiveDate)
    : { streak: 0, protectors: 0 };

  await db.transaction(async (tx) => {
    await writeBlockCheckTx(tx, block, blockId, effectiveDate, status as "done" | "skipped", note, resolved.text);
    // Marcar el bloque cascada hacia TODOS sus hábitos (principales y
    // secundarios) y su descendencia — saltar no marca nada, saltar no es
    // "hacerlo".
    if (status === "done") await cascadeBlockHabitsTx(tx, userId, blockId, effectiveDate, true);
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");

  if (status !== "done") {
    return {
      done: false,
      isMinimum: block.isMinimum,
      allMinimumsDone: false,
      streakBefore: streakBeforeResult.streak,
      streakAfter: streakBeforeResult.streak,
      protectorsBefore: streakBeforeResult.protectors,
      protectorsAfter: streakBeforeResult.protectors,
    };
  }

  const allMinimumsDone = block.isMinimum ? await allMinimumsDoneForPerson(planData, block.personId, effectiveDate) : false;

  const streakAfterResult = block.isMinimum
    ? await getStreakForPerson(ctx, block.personId, effectiveDate)
    : streakBeforeResult;

  return {
    done: true,
    isMinimum: block.isMinimum,
    allMinimumsDone,
    streakBefore: streakBeforeResult.streak,
    streakAfter: streakAfterResult.streak,
    protectorsBefore: streakBeforeResult.protectors,
    protectorsAfter: streakAfterResult.protectors,
  };
}

// Cambia el texto de un bloque solo para ese día, sin tocar la plantilla.
export async function setOverride(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  const text = String(formData.get("text") || "").trim();
  if (!date || !blockId || !text) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);
  assertDateMatchesWeekday(date, block.weekday);

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date, blockId, text, removed: false })
    .onConflictDoUpdate({
      target: [planOverrides.date, planOverrides.blockId],
      set: { text, removed: false, deferredQueueItem: false },
    });

  revalidatePath("/dashboard/plan");
}

// Quita un bloque de un día concreto (no de la plantilla semanal).
export async function removeForDay(formData: FormData) {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  if (!date || !blockId) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);
  assertDateMatchesWeekday(date, block.weekday);

  await db
    .insert(planOverrides)
    .values({ planId: block.planId, date, blockId, text: null, removed: true })
    .onConflictDoUpdate({
      target: [planOverrides.date, planOverrides.blockId],
      set: { removed: true, deferredQueueItem: false },
    });

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
      weekday: planBlocks.weekday,
      ownerId: plans.ownerId,
    })
    .from(planBlocks)
    .innerJoin(plans, eq(plans.id, planBlocks.planId))
    .where(eq(planBlocks.id, input.blockId));
  if (!block) throw new Error("Bloque no encontrado");
  assertDateMatchesWeekday(input.date, block.weekday);
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
      set: { startTime, durationMinutes, removed: false, deferredQueueItem: false },
    });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/agenda");
}

// Primera fecha >= `from` en que cae el weekday de un bloque — nunca pasa
// de 7 días porque el weekday se repite cada semana.
function nextOccurrenceOnOrAfter(weekday: number, from: string): string {
  for (let offset = 0; offset < 7; offset++) {
    const d = addDaysISO(from, offset);
    if (weekdayMon0(d) === weekday) return d;
  }
  return from; // inalcanzable
}

// Saca un bloque de Plan de HOY (o de varios días) sin que se pierda.
// `text` es el texto YA RESUELTO que se estaba mostrando (la cola pudo
// haber puesto cualquier cosa ahí) — lo manda quien llama porque ya lo
// tiene a mano al renderizar el bloque.
//
// Si el bloque viene de una cola (queueId): la cola solo avanza cuando se
// MARCA una actividad (ver shiftQueueCursor en setCheck) — así que alcanza
// con ocultar esta ocurrencia con un override "deferred" (no cuenta como
// consumida, regla 4 del resolver) para que el mismo item reaparezca
// entero en la fecha de llegada, sin reemplazar ni perder el item que le
// tocaría naturalmente ahí.
//
// La fecha de llegada es la primera ocurrencia del weekday de ESTE bloque
// en o después de `targetDate` (mañana, o la fecha elegida). Si entre hoy
// y esa fecha hay ocurrencias de OTRO bloque de la misma cola (ej. una
// cola compartida por varios días de la semana), también hay que ocultarlas
// — si no, consumirían la cola de todos modos y el item movido terminaría
// mostrándose en un lugar distinto al que pidió el usuario. Los días
// festivos con holiday_text no se tocan: ya no consumen la cola de por sí.
//
// Si el bloque NO viene de ninguna cola (texto fijo, ej. "Hacer cena"), no
// hay cola que corra — se mantiene el comportamiento anterior: una tarea
// suelta con vencimiento en la fecha elegida.
export async function moveBlock(input: { date: string; blockId: string; text: string; targetDate: string }) {
  const userId = await requireUserId();
  if (!input?.date || !input?.blockId || !input?.text?.trim() || !input?.targetDate) throw new Error("Faltan datos");
  if (input.targetDate < input.date) throw new Error("La fecha elegida no puede ser anterior a hoy");

  const block = await requireOwnedBlock(input.blockId, userId);
  assertDateMatchesWeekday(input.date, block.weekday);
  const text = input.text.trim();

  if (!block.queueId) {
    await db.transaction(async (tx) => {
      await tx
        .insert(planOverrides)
        .values({ planId: block.planId, date: input.date, blockId: input.blockId, text: null, removed: true })
        .onConflictDoUpdate({ target: [planOverrides.date, planOverrides.blockId], set: { removed: true, deferredQueueItem: false } });
      await tx.insert(tasks).values({ userId, title: text, dueDate: input.targetDate });
    });
    revalidatePath("/dashboard/plan");
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/actividades");
    return;
  }

  const landingDate = nextOccurrenceOnOrAfter(block.weekday, input.targetDate);

  const siblingBlocks = await db
    .select({ id: planBlocks.id, weekday: planBlocks.weekday, holidayText: planBlocks.holidayText })
    .from(planBlocks)
    .where(
      and(eq(planBlocks.planId, block.planId), eq(planBlocks.personId, block.personId), eq(planBlocks.queueId, block.queueId)),
    );

  const toDefer: { date: string; blockId: string }[] = [];
  let d = input.date;
  while (d < landingDate) {
    const weekday = weekdayMon0(d);
    for (const sib of siblingBlocks) {
      if (sib.weekday !== weekday) continue;
      if (sib.holidayText) continue; // festivo con texto propio no consume la cola — no hace falta ocultarlo
      toDefer.push({ date: d, blockId: sib.id });
    }
    d = addDaysISO(d, 1);
  }

  await db.transaction(async (tx) => {
    for (const { date, blockId } of toDefer) {
      await tx
        .insert(planOverrides)
        .values({ planId: block.planId, date, blockId, text: null, removed: true, deferredQueueItem: true })
        .onConflictDoUpdate({
          target: [planOverrides.date, planOverrides.blockId],
          set: { removed: true, deferredQueueItem: true },
        });
    }
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/actividades");
}

// "Mover al final de la cola": reordena plan_queue_items (misma fase/
// agrupamiento) poniendo este item último y renumerando — mismo patrón de
// deleteQueueItem en fases/actions.ts. NO toca el cursor: como las
// posiciones de los demás bajan un lugar, el cursor (que queda igual)
// pasa a apuntar al que antes era el siguiente item. Solo hace falta
// ocultar la ocurrencia de HOY (deferred, no consume) para que esa nueva
// posición se vea de inmediato.
export async function moveBlockToEndOfQueue(input: { date: string; blockId: string }) {
  const userId = await requireUserId();
  if (!input?.date || !input?.blockId) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(input.blockId, userId);
  assertDateMatchesWeekday(input.date, block.weekday);
  if (!block.queueId) throw new Error("Este bloque no viene de una cola");

  const [queue] = await db
    .select({ global: planQueues.global, cyclic: planQueues.cyclic })
    .from(planQueues)
    .where(eq(planQueues.id, block.queueId));
  if (!queue) throw new Error("Cola no encontrada");

  let phaseId: string | null = null;
  if (!queue.global) {
    const [phase] = await db
      .select({ id: planPhases.id })
      .from(planPhases)
      .where(and(lte(planPhases.startDate, input.date), gte(planPhases.endDate, input.date)));
    phaseId = phase?.id ?? null;
  }
  const groupFilter = phaseId
    ? and(eq(planQueueItems.queueId, block.queueId), eq(planQueueItems.phaseId, phaseId))
    : and(eq(planQueueItems.queueId, block.queueId), isNull(planQueueItems.phaseId));

  // El item "actual" (posición del cursor) es el que se va al final — no
  // hace falta saber cuál texto es: el resolver ya lo mostró hoy, y el
  // cursor sigue igual después de reordenar (ver comentario arriba).
  const cursorFilter = phaseId
    ? and(eq(planQueueCursors.queueId, block.queueId), eq(planQueueCursors.phaseId, phaseId))
    : and(eq(planQueueCursors.queueId, block.queueId), isNull(planQueueCursors.phaseId));

  await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: planQueueItems.id })
      .from(planQueueItems)
      .where(groupFilter)
      .orderBy(asc(planQueueItems.position));
    if (!siblings.length) return;

    const [cursor] = await tx.select({ position: planQueueCursors.position }).from(planQueueCursors).where(cursorFilter);
    const rawPosition = cursor?.position ?? 0;
    const currentIdx = queue.cyclic ? rawPosition % siblings.length : rawPosition;
    const current = siblings[currentIdx];
    if (!current) return; // no-cíclica agotada (mostrando el fallback): no hay item "actual" para mover

    const reordered = [...siblings.slice(0, currentIdx), ...siblings.slice(currentIdx + 1), current];
    for (let i = 0; i < reordered.length; i++) {
      await tx.update(planQueueItems).set({ position: i }).where(eq(planQueueItems.id, reordered[i].id));
    }

    await tx
      .insert(planOverrides)
      .values({ planId: block.planId, date: input.date, blockId: input.blockId, text: null, removed: true, deferredQueueItem: true })
      .onConflictDoUpdate({
        target: [planOverrides.date, planOverrides.blockId],
        set: { removed: true, deferredQueueItem: true },
      });
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/fases");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
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

// "Reiniciar desde hoy": pone plans.start_date en hoy (America/Bogota).
// Solo el dueño del plan — no tiene que ver con el cursor de las colas
// (eso vive aparte, en plan_queue_cursors, y no se toca acá), es nada más
// la fecha desde la que el dashboard busca "sin marcar de ayer" (ver
// app/dashboard/page.tsx) y desde la que arrancan /plan/historial y
// /plan/fases. Pensado para cuando se quiere cortar limpio con todo lo
// de antes sin borrar el historial ya guardado.
export async function resetPlanStartDate(formData: FormData) {
  const userId = await requireUserId();
  const planId = String(formData.get("planId") || "");
  if (!planId) throw new Error("Falta el plan");

  const [plan] = await db.select({ ownerId: plans.ownerId }).from(plans).where(eq(plans.id, planId));
  if (!plan) throw new Error("Plan no encontrado");
  if (plan.ownerId !== userId) throw new Error("No autorizado para este plan");

  await db.update(plans).set({ startDate: todayISO() }).where(eq(plans.id, planId));

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
  revalidatePath("/dashboard/plan/fases");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
}

// Agrega un hábito activo que no tiene ningún bloque al Plan — crea el
// bloque (kind "habito", texto = nombre del hábito) y el link en
// plan_block_activities. Pensado para la sección "Por revisar" del
// dashboard: hábitos huérfanos (ver lib/plan/orphans.ts).
export async function addHabitToPlan(input: { activityId: string; weekday: number; startTime: string }) {
  const userId = await requireUserId();
  const { activityId, weekday, startTime } = input;
  if (weekday < 0 || weekday > 6) throw new Error("Día inválido");
  if (!startTime) throw new Error("Falta la hora");

  const [activity] = await db
    .select({ id: activities.id, name: activities.name })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));
  if (!activity) throw new Error("Hábito no encontrado");

  const person = await findPlanPersonForUser(userId);
  if (!person) throw new Error("No tenés un plan");

  const [block] = await db
    .insert(planBlocks)
    .values({
      planId: person.planId,
      personId: person.personId,
      weekday,
      startTime,
      endTime: null,
      text: activity.name,
      kind: "habito",
    })
    .returning({ id: planBlocks.id });

  await db.insert(planBlockActivities).values({ blockId: block.id, activityId: activity.id });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
}

// Quita un bloque del Plan — borra planBlocks (cascada limpia
// planBlockActivities/planChecks/planOverrides). Para "Por revisar": un
// bloque cuyo hábito ya está inactivo.
export async function removePlanBlock(input: { blockId: string }) {
  const userId = await requireUserId();
  await requireOwnedBlock(input.blockId, userId);

  await db.delete(planBlocks).where(eq(planBlocks.id, input.blockId));

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
}

// Resultado de marcar/desmarcar UN hábito — para que toggleLogToday
// (habitos/actions.ts) elija UN solo toast, el del nivel más alto que se
// completó con este click: si un bloque quedó done por esta cascada,
// `blockToastMessage` ya trae el mensaje correcto (hito de racha >
// protector > bloque cumplido) con más prioridad que festejar solo el
// hábito o su padre.
export type HabitCascadeResult = {
  parentJustCompleted: boolean;
  blockToastMessage: string | null;
};

// Punto de entrada desde toggleLogToday — TODO en una transacción: cascada
// hacia abajo (el hábito clickeado y toda su descendencia quedan en
// `done`) y, si su ancestro de primer nivel enlaza algún bloque, cascada
// hacia arriba (si con esto todos los hábitos de primer nivel del bloque
// —o todos los principales— quedan done, el bloque se marca done; si deja
// de estarlo, se desmarca — salvo que esté "skipped", eso no se pisa).
export async function applyHabitToggle(
  userId: string,
  activityId: string,
  date: string,
  done: boolean,
): Promise<HabitCascadeResult> {
  const [activity] = await db
    .select({ parentId: activities.parentId })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));
  if (!activity) throw new Error("Hábito no encontrado");

  const topId = await findTopAncestorId(activityId);
  const blockLinks = await db
    .select({ blockId: planBlockActivities.blockId })
    .from(planBlockActivities)
    .where(eq(planBlockActivities.activityId, topId));

  const ctx = blockLinks.length ? await loadPlanContextForUser(userId) : null;
  const planData = ctx ? toPlanData(ctx) : null;

  type BlockInfo = {
    blockId: string;
    personId: string;
    planId: string;
    isMinimum: boolean;
    wasDone: boolean;
    streakBefore: number;
    protectorsBefore: number;
  };
  const blockInfos: BlockInfo[] = [];
  if (ctx) {
    for (const { blockId } of blockLinks) {
      const block = await requireOwnedBlock(blockId, userId).catch(() => null);
      if (!block) continue;
      const [existingCheck] = await db
        .select({ status: planChecks.status })
        .from(planChecks)
        .where(and(eq(planChecks.blockId, blockId), eq(planChecks.date, date)));
      const streak = block.isMinimum ? await getStreakForPerson(ctx, block.personId, date) : { streak: 0, protectors: 0 };
      blockInfos.push({
        blockId,
        personId: block.personId,
        planId: block.planId,
        isMinimum: block.isMinimum,
        wasDone: existingCheck?.status === "done",
        streakBefore: streak.streak,
        protectorsBefore: streak.protectors,
      });
    }
  }

  let parentJustCompleted = false;
  const blockOutcomes: { info: BlockInfo; nowDone: boolean }[] = [];

  await db.transaction(async (tx) => {
    const descendantIds = await collectDescendantIdsTx(tx, activityId);
    await setLogsForIdsTx(tx, userId, [activityId, ...descendantIds], date, done);

    // Padre completado: todos los hermanos (mismo parent_id) quedaron done
    // con este click — solo tiene sentido al marcar, no al desmarcar.
    if (done && activity.parentId) {
      const siblings = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.parentId, activity.parentId), eq(activities.isActive, true)));
      if (siblings.length > 0) {
        const results = await Promise.all(siblings.map((s) => isActivityDoneOnDateTx(tx, userId, s.id, date)));
        parentJustCompleted = results.every(Boolean);
      }
    }

    for (const info of blockInfos) {
      const level1 = await tx
        .select({ id: activities.id, isOptional: activities.isOptional })
        .from(planBlockActivities)
        .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
        .where(and(eq(planBlockActivities.blockId, info.blockId), eq(activities.isActive, true)));
      if (level1.length === 0) continue;

      const doneFlags = await Promise.all(level1.map((a) => isActivityDoneOnDateTx(tx, userId, a.id, date)));
      const allLevel1Done = doneFlags.every(Boolean);
      const principalDone = level1
        .map((a, i) => ({ isOptional: a.isOptional, done: doneFlags[i] }))
        .filter((a) => !a.isOptional);
      const allPrincipalDone = principalDone.length > 0 && principalDone.every((a) => a.done);
      const shouldBeDone = allLevel1Done || allPrincipalDone;

      const [existingCheckTx] = await tx
        .select({ status: planChecks.status })
        .from(planChecks)
        .where(and(eq(planChecks.blockId, info.blockId), eq(planChecks.date, date)));
      if (existingCheckTx?.status === "skipped") continue;

      if (shouldBeDone && existingCheckTx?.status !== "done") {
        const [day] = resolvePlan(planData!, date, date);
        const resolved = day?.blocksByPerson[info.personId]?.find((b) => b.blockId === info.blockId);
        await writeBlockCheckTx(tx, info, info.blockId, date, "done", null, resolved?.text ?? "");
        blockOutcomes.push({ info, nowDone: true });
      } else if (!shouldBeDone && existingCheckTx?.status === "done") {
        await writeBlockCheckTx(tx, info, info.blockId, date, "", null, "");
        blockOutcomes.push({ info, nowDone: false });
      }
    }
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");

  let blockToastMessage: string | null = null;
  if (done) {
    const justCompleted = blockOutcomes.find((o) => o.nowDone && !o.info.wasDone);
    if (justCompleted) {
      if (justCompleted.info.isMinimum) {
        const streakAfter = await getStreakForPerson(ctx!, justCompleted.info.personId, date);
        const milestone = streakMilestoneCrossed(justCompleted.info.streakBefore, streakAfter.streak);
        if (milestone) {
          blockToastMessage = pickStreakMilestoneMessage(milestone);
        } else if (streakAfter.protectors > justCompleted.info.protectorsBefore) {
          blockToastMessage = pickProtectorGainedMessage();
        }
      }
      if (!blockToastMessage) {
        const allMinimumsDone = await allMinimumsDoneForPerson(planData!, justCompleted.info.personId, date);
        blockToastMessage = pickBlockPraise({ isMinimum: justCompleted.info.isMinimum, allMinimumsDone });
      }
    }
  }

  return { parentJustCompleted, blockToastMessage };
}

// ─── Gestión del árbol de hábitos (nombre/hora/secundario, orden, mover,
// agregar, desactivar) — server-first, sin drag-and-drop: botones ↑/↓ para
// orden y un menú (ver HabitNodeMenu) para el resto. ───────────────────────

async function requireOwnedActivityRow(id: string, userId: string) {
  const [row] = await db
    .select({
      id: activities.id,
      name: activities.name,
      parentId: activities.parentId,
      isOptional: activities.isOptional,
      horaSugerida: activities.horaSugerida,
      sortOrder: activities.sortOrder,
    })
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));
  if (!row) throw new Error("Hábito no encontrado");
  return row;
}

// Profundidad de un nodo: 1 = primer nivel (enlazado en
// plan_block_activities), 2 = hijo, 3 = nieto.
async function depthOf(activityId: string, userId: string): Promise<number> {
  let depth = 1;
  let current = await requireOwnedActivityRow(activityId, userId);
  while (current.parentId) {
    depth++;
    current = await requireOwnedActivityRow(current.parentId, userId);
  }
  return depth;
}

// Altura del subárbol propio del nodo (1 = sin hijos, 2 = tiene hijos sin
// nietos, 3 = tiene nietos) — para no dejar una rama a más de 3 niveles al
// moverla o anidarla.
async function subtreeHeight(activityId: string): Promise<number> {
  const children = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.parentId, activityId), eq(activities.isActive, true)));
  if (children.length === 0) return 1;
  const heights = await Promise.all(children.map((c) => subtreeHeight(c.id)));
  return 1 + Math.max(...heights);
}

// Nombre, hora sugerida y si es secundario (is_optional) — no toca
// frequency/categoría/etc, a diferencia de updateActivity en habitos/
// actions.ts (que exige mandar la fila entera).
export async function updateHabitNode(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const horaSugerida = String(formData.get("horaSugerida") || "") || null;
  const isOptional = formData.get("isOptional") === "on";
  if (!id || !name) throw new Error("Faltan datos");

  await requireOwnedActivityRow(id, userId);
  await db.update(activities).set({ name, horaSugerida, isOptional }).where(eq(activities.id, id));

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

// Sube/baja un hábito o subhábito un puesto dentro de sus hermanos — si no
// tiene padre (primer nivel), los hermanos son los demás hábitos de primer
// nivel del MISMO bloque (hace falta `blockId`); si tiene padre, son los
// demás hijos de ese padre. Renumera todos los hermanos a 0..n-1 primero
// (por si había sort_order repetidos o salteados) y recién ahí intercambia
// — así el cambio siempre se nota, no depende de qué valores traía antes.
export async function reorderHabitNode(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const blockId = String(formData.get("blockId") || "") || null;
  const direction = String(formData.get("direction") || "");
  if (!id || (direction !== "up" && direction !== "down")) throw new Error("Faltan datos");

  const node = await requireOwnedActivityRow(id, userId);

  let siblings: { id: string; name: string; sortOrder: number }[];
  if (node.parentId) {
    siblings = await db
      .select({ id: activities.id, name: activities.name, sortOrder: activities.sortOrder })
      .from(activities)
      .where(and(eq(activities.parentId, node.parentId), eq(activities.isActive, true)));
  } else {
    if (!blockId) throw new Error("Falta el bloque");
    await requireOwnedBlock(blockId, userId);
    siblings = await db
      .select({ id: activities.id, name: activities.name, sortOrder: activities.sortOrder })
      .from(planBlockActivities)
      .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
      .where(and(eq(planBlockActivities.blockId, blockId), eq(activities.isActive, true)));
  }
  siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;

  await db.transaction(async (tx) => {
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].sortOrder !== i) await tx.update(activities).set({ sortOrder: i }).where(eq(activities.id, siblings[i].id));
    }
    await tx.update(activities).set({ sortOrder: swapIdx }).where(eq(activities.id, siblings[idx].id));
    await tx.update(activities).set({ sortOrder: idx }).where(eq(activities.id, siblings[swapIdx].id));
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

// Mueve un subhábito (debe tener padre) a otro padre — valida que no se
// mueva dentro de su propia rama (ciclo) y que la rama movida no termine a
// más de 3 niveles de profundidad.
export async function moveHabitNodeToParent(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const newParentId = String(formData.get("newParentId") || "");
  if (!id || !newParentId) throw new Error("Faltan datos");
  if (id === newParentId) throw new Error("No se puede mover a sí mismo");

  const node = await requireOwnedActivityRow(id, userId);
  if (!node.parentId) throw new Error("Este hábito ya es de primer nivel");

  await requireOwnedActivityRow(newParentId, userId);
  const newParentDepth = await depthOf(newParentId, userId);
  if (newParentDepth > 2) throw new Error("Ese hábito ya es un subhábito de tercer nivel — no puede tener hijos");

  let cursor: string | null = newParentId;
  while (cursor) {
    if (cursor === id) throw new Error("No se puede mover dentro de su propia rama");
    const row = await requireOwnedActivityRow(cursor, userId);
    cursor = row.parentId;
  }

  const height = await subtreeHeight(id);
  if (newParentDepth + height > 3) throw new Error("Ese movimiento dejaría hábitos a más de 3 niveles de profundidad");

  await db.update(activities).set({ parentId: newParentId }).where(eq(activities.id, id));

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

// Mueve un subhábito (debe tener padre) al primer nivel de un bloque —
// quita el parent_id y lo enlaza en plan_block_activities si no estaba ya.
export async function moveHabitNodeToTopLevel(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const blockId = String(formData.get("blockId") || "");
  if (!id || !blockId) throw new Error("Faltan datos");

  const node = await requireOwnedActivityRow(id, userId);
  if (!node.parentId) throw new Error("Este hábito ya es de primer nivel");
  await requireOwnedBlock(blockId, userId);

  await db.transaction(async (tx) => {
    await tx.update(activities).set({ parentId: null }).where(eq(activities.id, id));
    const [existingLink] = await tx
      .select({ blockId: planBlockActivities.blockId })
      .from(planBlockActivities)
      .where(and(eq(planBlockActivities.blockId, blockId), eq(planBlockActivities.activityId, id)));
    if (!existingLink) await tx.insert(planBlockActivities).values({ blockId, activityId: id });
  });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

// Agrega un subhábito nuevo bajo `parentId` — rechaza si el padre ya está
// en el último nivel permitido (3).
export async function addHabitChild(formData: FormData) {
  const userId = await requireUserId();
  const parentId = String(formData.get("parentId") || "");
  const name = String(formData.get("name") || "").trim();
  const isOptional = formData.get("isOptional") === "on";
  if (!parentId || !name) throw new Error("Faltan datos");

  await requireOwnedActivityRow(parentId, userId);
  const parentDepth = await depthOf(parentId, userId);
  if (parentDepth >= 3) throw new Error("Ese hábito ya está en el último nivel — no puede tener hijos");

  const siblings = await db
    .select({ sortOrder: activities.sortOrder })
    .from(activities)
    .where(and(eq(activities.parentId, parentId), eq(activities.isActive, true)));
  const nextSort = siblings.length ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0;

  await db.insert(activities).values({ userId, name, parentId, isOptional, sortOrder: nextSort, frequency: "diaria" });

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}
