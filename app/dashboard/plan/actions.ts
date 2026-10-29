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
import { activityLogs } from "@/lib/db/schema/habitos";
import { tasks } from "@/lib/db/schema/trabajo";
import { loadPlanContextForUser, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { addDaysISO, weekdayMon0, todayISO } from "@/lib/date/bogota";

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
    .select({
      id: planBlocks.id,
      planId: planBlocks.planId,
      personId: planBlocks.personId,
      queueId: planBlocks.queueId,
      weekday: planBlocks.weekday,
      holidayText: planBlocks.holidayText,
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
    await db.transaction(async (tx) => {
      const [existed] = await tx
        .select({ blockId: planChecks.blockId })
        .from(planChecks)
        .where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));
      await tx.delete(planChecks).where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));
      if (existed) await shiftQueueCursor(tx, blockId, date, -1);
    });
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

  await db.transaction(async (tx) => {
    const [existed] = await tx
      .select({ blockId: planChecks.blockId })
      .from(planChecks)
      .where(and(eq(planChecks.date, date), eq(planChecks.blockId, blockId)));

    await tx
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

    if (!existed) await shiftQueueCursor(tx, blockId, date, 1);
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
