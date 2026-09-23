"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { plans, planPhases, planQueues, planQueueItems } from "@/lib/db/schema/plan";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function requireOwnedPlanId(userId: string) {
  const [row] = await db.select({ id: plans.id }).from(plans).where(eq(plans.ownerId, userId)).limit(1);
  if (!row) throw new Error("No hay plan");
  return row.id;
}

function revalidateAll() {
  revalidatePath("/dashboard/plan/fases");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/semana");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "cola"
  );
}

// Crea una fase nueva al final del orden actual — antes solo se podían
// crear corriendo un script a mano.
export async function createPhase(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const goal = String(formData.get("goal") || "").trim() || null;

  if (!name || !startDate || !endDate) throw new Error("Faltan datos");
  if (startDate > endDate) throw new Error("La fecha de inicio no puede ser posterior a la de fin");

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${planPhases.sortOrder}), -1)` })
    .from(planPhases)
    .where(eq(planPhases.planId, planId));

  await db.insert(planPhases).values({ planId, name, startDate, endDate, goal, sortOrder: Number(maxOrder) + 1 });
  revalidateAll();
}

// Borra una fase — sus items de cola por-fase se van con ella (cascade),
// las colas globales no se tocan.
export async function deletePhase(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  await db.delete(planPhases).where(and(eq(planPhases.id, id), eq(planPhases.planId, planId)));
  revalidateAll();
}

// Crea una cola nueva — `key` se deriva del nombre (para el `plan_queues_
// plan_key_idx` único) con sufijo numérico si ya existe una igual.
export async function createQueue(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const name = String(formData.get("name") || "").trim();
  const cyclic = formData.get("cyclic") === "on";
  const global = formData.get("global") === "on";
  const fallback = String(formData.get("fallback") || "").trim() || null;
  if (!name) throw new Error("Falta el nombre de la cola");

  const baseKey = slugify(name);
  let key = baseKey;
  let n = 1;
  for (;;) {
    const [clash] = await db
      .select({ id: planQueues.id })
      .from(planQueues)
      .where(and(eq(planQueues.planId, planId), eq(planQueues.key, key)));
    if (!clash) break;
    n += 1;
    key = `${baseKey}_${n}`;
  }

  await db.insert(planQueues).values({ planId, key, name, cyclic, global, fallback });
  revalidateAll();
}

// Borra una cola — sus items se van con ella (cascade); los bloques que
// la usaban quedan sin cola (set null) y vuelven a mostrar su texto fijo.
export async function deleteQueue(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  await db.delete(planQueues).where(and(eq(planQueues.id, id), eq(planQueues.planId, planId)));
  revalidateAll();
}

export async function updatePhase(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const goal = String(formData.get("goal") || "").trim() || null;

  if (!id || !name || !startDate || !endDate) throw new Error("Faltan datos");
  if (startDate > endDate) throw new Error("La fecha de inicio no puede ser posterior a la de fin");

  await db
    .update(planPhases)
    .set({ name, startDate, endDate, goal })
    .where(and(eq(planPhases.id, id), eq(planPhases.planId, planId)));

  revalidateAll();
}

async function requireOwnedItem(id: string, planId: string) {
  const [row] = await db
    .select({
      id: planQueueItems.id,
      queueId: planQueueItems.queueId,
      phaseId: planQueueItems.phaseId,
      position: planQueueItems.position,
    })
    .from(planQueueItems)
    .innerJoin(planQueues, eq(planQueueItems.queueId, planQueues.id))
    .where(and(eq(planQueueItems.id, id), eq(planQueues.planId, planId)));
  if (!row) throw new Error("Item no encontrado");
  return row;
}

function sameGroup(phaseId: string | null) {
  return phaseId ? eq(planQueueItems.phaseId, phaseId) : isNull(planQueueItems.phaseId);
}

// Agrega un item al final de una cola (o fase) — reemplaza tener que
// reescribir toda la lista en el textarea para sumar uno solo.
export async function addQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const queueId = String(formData.get("queueId") || "");
  const phaseId = String(formData.get("phaseId") || "") || null;
  const text = String(formData.get("text") || "").trim();
  if (!text) throw new Error("Falta el texto del item");

  const [queue] = await db
    .select({ id: planQueues.id })
    .from(planQueues)
    .where(and(eq(planQueues.id, queueId), eq(planQueues.planId, planId)));
  if (!queue) throw new Error("Cola no encontrada");

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${planQueueItems.position}), -1)` })
    .from(planQueueItems)
    .where(and(eq(planQueueItems.queueId, queueId), sameGroup(phaseId)));

  await db.insert(planQueueItems).values({ queueId, phaseId, position: Number(maxPos) + 1, text });
  revalidateAll();
}

// Edita el texto, la nota y el guion/libro vinculado de UN item — sin
// tocar los demás.
export async function updateQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  await requireOwnedItem(id, planId);

  const text = String(formData.get("text") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const scriptId = String(formData.get("scriptId") || "") || null;
  const bookId = String(formData.get("bookId") || "") || null;
  if (!text) throw new Error("Falta el texto del item");

  await db.update(planQueueItems).set({ text, notes, scriptId, bookId }).where(eq(planQueueItems.id, id));
  revalidateAll();
}

// Borra UN item y renumera los que quedan (0..n-1 contiguo, mismo patrón
// que los slides de Guiones) para que la rotación de la cola siga sin
// huecos.
export async function deleteQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  const item = await requireOwnedItem(id, planId);

  await db.transaction(async (tx) => {
    await tx.delete(planQueueItems).where(eq(planQueueItems.id, id));
    const siblings = await tx
      .select({ id: planQueueItems.id })
      .from(planQueueItems)
      .where(and(eq(planQueueItems.queueId, item.queueId), sameGroup(item.phaseId)))
      .orderBy(asc(planQueueItems.position));
    for (let i = 0; i < siblings.length; i++) {
      await tx.update(planQueueItems).set({ position: i }).where(eq(planQueueItems.id, siblings[i].id));
    }
  });
  revalidateAll();
}

// Mueve un item un puesto arriba/abajo dentro de su cola (y fase) —
// intercambia posición con el vecino.
export async function moveQueueItem(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  const direction = String(formData.get("direction") || "");
  const item = await requireOwnedItem(id, planId);

  const siblings = await db
    .select({ id: planQueueItems.id, position: planQueueItems.position })
    .from(planQueueItems)
    .where(and(eq(planQueueItems.queueId, item.queueId), sameGroup(item.phaseId)))
    .orderBy(asc(planQueueItems.position));

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  await db.transaction(async (tx) => {
    await tx.update(planQueueItems).set({ position: b.position }).where(eq(planQueueItems.id, a.id));
    await tx.update(planQueueItems).set({ position: a.position }).where(eq(planQueueItems.id, b.id));
  });
  revalidateAll();
}

// Reescribe TODA la lista de una cola para una fase (o global, si
// phaseId viene vacío) a partir de un textarea, una tarea por línea —
// opción secundaria para pegar/cargar varios items de una vez. Para
// items sueltos usa add/update/delete/moveQueueItem arriba.
export async function replaceQueueItems(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const queueId = String(formData.get("queueId") || "");
  const phaseId = String(formData.get("phaseId") || "") || null;
  const linesRaw = String(formData.get("lines") || "");

  const [queue] = await db
    .select({ id: planQueues.id })
    .from(planQueues)
    .where(and(eq(planQueues.id, queueId), eq(planQueues.planId, planId)));
  if (!queue) throw new Error("Cola no encontrada");

  if (phaseId) {
    const [phase] = await db
      .select({ id: planPhases.id })
      .from(planPhases)
      .where(and(eq(planPhases.id, phaseId), eq(planPhases.planId, planId)));
    if (!phase) throw new Error("Fase no encontrada");
  }

  const lines = linesRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  await db.transaction(async (tx) => {
    await tx
      .delete(planQueueItems)
      .where(
        and(
          eq(planQueueItems.queueId, queueId),
          phaseId ? eq(planQueueItems.phaseId, phaseId) : isNull(planQueueItems.phaseId),
        ),
      );
    if (lines.length) {
      await tx.insert(planQueueItems).values(lines.map((text, position) => ({ queueId, phaseId, position, text })));
    }
  });

  revalidateAll();
}
