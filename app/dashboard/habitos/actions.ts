"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs, activityQueueItems } from "@/lib/db/schema/habitos";
import { applyHabitToggle } from "@/app/dashboard/plan/actions";
import { pickHabitPraise } from "@/lib/habits/praise";
import { isCounterDone, parseCountSteps } from "@/lib/habits/counter";

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
  revalidatePath("/dashboard/plan");
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
    // Crear el log de hoy equivale a marcar el hábito hecho — pasa por la
    // misma cascada que toggleLogToday (marca descendientes, sube al
    // padre y al bloque/plan_check) en vez de insertar la fila suelta;
    // después le pone el value/notes propios a la fila que quedó creada.
    await applyHabitToggle(userId, activityId, date, true);
    const [own] = await db
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)))
      .orderBy(desc(activityLogs.createdAt))
      .limit(1);
    if (own) await db.update(activityLogs).set({ value, notes }).where(eq(activityLogs.id, own.id));
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
  const rawTarget = Number(formData.get("targetValue"));
  const targetValue = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
  const unit = String(formData.get("unit") || "").trim() || null;
  const countSteps = parseCountSteps(String(formData.get("countSteps") || ""));

  if (!name) throw new Error("El nombre es obligatorio");
  if (!FREQUENCIES.includes(frequency)) {
    throw new Error("Frecuencia inválida");
  }

  await db
    .update(activities)
    .set({ name, category, frequency, horaSugerida, sortOrder, diasSemana, targetValue, unit, countSteps })
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
// Devuelve el estado resultante (no solo void) para que quien llama desde
// el cliente (ver SafeActionButton) pueda decidir un toast de
// felicitación: `isPrincipal` = hábito diario (los que se muestran en la
// card "Hábitos" con racha — los "Vicios", frequency='recurrente', son
// contadores y nunca pasan por este toggle). `allPrincipalDone` solo se
// calcula al marcar (no al desmarcar) y solo si el hábito es principal —
// compara hábitos diarios activos vs. cuántos ya tienen log ese día.
// Devuelve un solo `toastMessage` ya resuelto — el del nivel más alto que
// se completó con ESTE click (hito de racha de bloque > protector > bloque
// cumplido > "día cumplido" dashboard-wide > padre completado > hábito
// simple) — así la UI muestra un único toast, nunca dos por el mismo
// click. `applyHabitToggle` hace TODA la escritura (el log del hábito, su
// descendencia, y el/los bloque(s) que enlazan su ancestro de primer
// nivel) en una sola transacción.
export async function toggleLogToday(formData: FormData): Promise<{ done: boolean; toastMessage: string | null }> {
  const userId = await requireUserId();
  const activityId = String(formData.get("activityId") || "");
  const date = String(formData.get("date") || "");

  const [activity] = await db
    .select({ frequency: activities.frequency, parentId: activities.parentId, targetValue: activities.targetValue })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));

  const [existing] = await db
    .select({ value: activityLogs.value })
    .from(activityLogs)
    .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)));
  // Para un hábito contador, "hecho" depende de llegar a la meta, no de la
  // mera existencia del log (puede haber un log con valor parcial, todavía
  // no hecho) — marcar a mano siempre alterna el estado REAL, nunca solo la
  // existencia de la fila.
  const wasDone = isCounterDone(existing?.value, activity?.targetValue);
  const done = !wasDone;

  const isPrincipal = activity?.frequency === "diaria";
  const hasParent = !!activity?.parentId;

  // Marcar a mano un contador pone el valor exacto en la meta — se pasa
  // como valueOverride para que quede escrito ANTES de que la cascada
  // calcule el done hacia arriba (si no, un log parcial preexistente
  // haría que el bloque nunca se marque, aunque el hábito sí quede done).
  const cascade = await applyHabitToggle(
    userId,
    activityId,
    date,
    done,
    done && activity?.targetValue != null ? activity.targetValue : undefined,
  );

  revalidateAll();

  // "Día cumplido" es dashboard-wide — solo hábitos de primer nivel
  // (parent_id null) cuentan, un hijo nunca lo dispara (ver
  // lib/plan/sub-habits.ts para la regla de done por árbol).
  let allPrincipalDone = false;
  if (done && isPrincipal && !hasParent) {
    const dailyHabits = await db
      .select({ id: activities.id, targetValue: activities.targetValue })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.isActive, true),
          eq(activities.frequency, "diaria"),
          isNull(activities.parentId),
        ),
      );
    if (dailyHabits.length > 0) {
      const targetById = new Map(dailyHabits.map((h) => [h.id, h.targetValue]));
      const todayLogs = await db
        .select({ activityId: activityLogs.activityId, value: activityLogs.value })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.userId, userId),
            eq(activityLogs.date, date),
            inArray(activityLogs.activityId, dailyHabits.map((h) => h.id)),
          ),
        );
      const doneIds = new Set(
        todayLogs.filter((l) => isCounterDone(l.value, targetById.get(l.activityId))).map((l) => l.activityId),
      );
      allPrincipalDone = doneIds.size === dailyHabits.length;
    }
  }

  let toastMessage: string | null = null;
  if (done) {
    if (cascade.blockToastMessage) {
      toastMessage = cascade.blockToastMessage;
    } else if (allPrincipalDone) {
      toastMessage = pickHabitPraise({ isPrincipal: true, allPrincipalDone: true });
    } else if (cascade.parentJustCompleted) {
      toastMessage = pickHabitPraise({ isPrincipal, allPrincipalDone: false, hasParent: true, parentJustCompleted: true });
    } else {
      toastMessage = pickHabitPraise({ isPrincipal, allPrincipalDone: false, hasParent, parentJustCompleted: false });
    }
  }

  return { done, toastMessage };
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

// Botones +100/+200/−100 de un hábito con meta ("1000 saltos"): un solo log
// por día que se corrige en el acto (no una fila por click, a diferencia de
// incrementLog/decrementLog de arriba, que son para "recurrentes"). Si el
// nuevo valor cruza la meta hacia arriba o hacia abajo, pasa por
// applyHabitToggle para que la cascada (padre/bloque, felicitación) se
// dispare igual que con el checkbox — después se reescribe `value` con el
// total real (puede pasarse de la meta, eso es válido), porque
// applyHabitToggle solo sabe crear filas con 1 o borrarlas, no sumar.
export async function adjustCounter(input: { activityId: string; date: string; delta: number }): Promise<{
  value: number;
  done: boolean;
  toastMessage: string | null;
}> {
  const userId = await requireUserId();
  const { activityId, date, delta } = input;
  if (!activityId || !date || !Number.isFinite(delta)) throw new Error("Faltan datos");

  const [activity] = await db
    .select({ frequency: activities.frequency, parentId: activities.parentId, targetValue: activities.targetValue })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)));
  if (!activity) throw new Error("Hábito no encontrado");

  const [existing] = await db
    .select({ value: activityLogs.value })
    .from(activityLogs)
    .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)));

  const current = existing?.value ?? 0;
  const value = Math.max(0, current + delta);
  const wasDone = isCounterDone(current, activity.targetValue);
  const nowDone = isCounterDone(value, activity.targetValue);

  if (nowDone === wasDone) {
    // No cruza la meta: solo corregir el valor, sin cascada — ni este
    // hábito ni el bloque cambian de estado done/no-done.
    if (value === 0) {
      await db
        .delete(activityLogs)
        .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)));
    } else {
      const [row] = await db
        .select({ id: activityLogs.id })
        .from(activityLogs)
        .where(and(eq(activityLogs.activityId, activityId), eq(activityLogs.userId, userId), eq(activityLogs.date, date)));
      if (row) {
        await db.update(activityLogs).set({ value }).where(eq(activityLogs.id, row.id));
      } else {
        await db.insert(activityLogs).values({ userId, activityId, date, value });
      }
    }
    revalidateAll();
    return { value, done: nowDone, toastMessage: null };
  }

  // Cruza la meta: applyHabitToggle escribe el valor real ANTES de
  // calcular el done hacia arriba (padre/bloque), todo en una sola
  // transacción — así el bloque se marca/desmarca con el estado
  // correcto, no con el valor intermedio que deja la cascada genérica.
  const cascade = await applyHabitToggle(userId, activityId, date, nowDone, value);
  revalidateAll();

  let toastMessage: string | null = null;
  if (nowDone) {
    const isPrincipal = activity.frequency === "diaria";
    const hasParent = !!activity.parentId;
    toastMessage =
      cascade.blockToastMessage ??
      pickHabitPraise({
        isPrincipal,
        allPrincipalDone: false,
        hasParent,
        parentJustCompleted: cascade.parentJustCompleted,
      });
  }

  return { value, done: nowDone, toastMessage };
}
