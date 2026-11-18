"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, lte, gte } from "drizzle-orm";
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

// Un bloque de Plan puede tener uno o más hábitos enlazados
// (plan_block_activities): el que comparte nombre con el bloque es el
// hábito PRINCIPAL, los demás son subhábitos opcionales (se marcan aparte,
// desde el desplegable — ver toggleLogToday). Marcar el bloque solo
// sincroniza el log del principal (si hay uno con ese nombre); los
// secundarios NO se auto-marcan — pedido explícito del usuario, para no
// meter datos falsos de algo que no se hizo de verdad.
async function syncLinkedHabitLogs(userId: string, blockId: string, blockText: string, date: string, done: boolean) {
  const links = await db
    .select({ activityId: planBlockActivities.activityId, name: activities.name })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .where(eq(planBlockActivities.blockId, blockId));
  const principal = links.find((l) => l.name === blockText);
  if (!principal) return;
  const activityId = principal.activityId;

  if (!done) {
    await db
      .delete(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), eq(activityLogs.activityId, activityId)));
    return;
  }

  const [existing] = await db
    .select({ activityId: activityLogs.activityId })
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date), eq(activityLogs.activityId, activityId)));
  if (!existing) {
    await db.insert(activityLogs).values({ userId, activityId, date });
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
// resolved_text se calcula acá (con el resolver, sobre el plan completo) y
// queda fijo: si luego se reordena una cola o se edita el bloque, el
// historial no cambia. Devuelve info para que el cliente (SafeActionButton)
// decida un toast de felicitación/racha — undefined al desmarcar (no hay
// nada que festejar). Lanza "El bloque no aplica ese día" si `date` no
// resuelve ninguna fecha válida — el cliente lo atrapa y lo muestra como
// toast, no tumba la página.
export async function setCheck(formData: FormData): Promise<SetCheckResult | undefined> {
  const userId = await requireUserId();
  const date = String(formData.get("date") || "");
  const blockId = String(formData.get("blockId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!date || !blockId) throw new Error("Faltan datos");

  const block = await requireOwnedBlock(blockId, userId);

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) throw new Error("No hay plan");
  const planData = toPlanData(ctx);

  const effectiveDate = resolveEffectiveDate(planData, block.personId, blockId, date, nowHHMM());
  if (!effectiveDate) throw new Error("El bloque no aplica ese día");

  if (!status) {
    await db.transaction(async (tx) => {
      const [existed] = await tx
        .select({ blockId: planChecks.blockId })
        .from(planChecks)
        .where(and(eq(planChecks.date, effectiveDate), eq(planChecks.blockId, blockId)));
      await tx.delete(planChecks).where(and(eq(planChecks.date, effectiveDate), eq(planChecks.blockId, blockId)));
      if (existed) await shiftQueueCursor(tx, blockId, effectiveDate, -1);
    });
    await syncLinkedHabitLogs(userId, blockId, block.text, effectiveDate, false);
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
    const [existed] = await tx
      .select({ blockId: planChecks.blockId })
      .from(planChecks)
      .where(and(eq(planChecks.date, effectiveDate), eq(planChecks.blockId, blockId)));

    await tx
      .insert(planChecks)
      .values({
        planId: block.planId,
        date: effectiveDate,
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

    if (!existed) await shiftQueueCursor(tx, blockId, effectiveDate, 1);
  });
  await syncLinkedHabitLogs(userId, blockId, block.text, effectiveDate, status === "done");

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

  const allMinimums = day?.blocksByPerson[block.personId]?.filter((b) => b.isMinimum) ?? [];
  let allMinimumsDone = false;
  if (block.isMinimum && allMinimums.length > 0) {
    const doneChecks = await db
      .select({ blockId: planChecks.blockId })
      .from(planChecks)
      .where(and(eq(planChecks.date, effectiveDate), eq(planChecks.personId, block.personId), eq(planChecks.status, "done")));
    const doneIds = new Set(doneChecks.map((c) => c.blockId));
    allMinimumsDone = allMinimums.every((b) => doneIds.has(b.blockId));
  }

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
