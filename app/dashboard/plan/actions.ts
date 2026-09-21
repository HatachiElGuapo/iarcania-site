"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { plans, planBlocks, planChecks, planOverrides } from "@/lib/db/schema/plan";
import { loadPlanContext, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function requireOwnedBlock(blockId: string, userId: string) {
  const [row] = await db
    .select({ id: planBlocks.id, planId: planBlocks.planId, personId: planBlocks.personId })
    .from(planBlocks)
    .innerJoin(plans, eq(plans.id, planBlocks.planId))
    .where(and(eq(planBlocks.id, blockId), eq(plans.ownerId, userId)));
  if (!row) throw new Error("Bloque no encontrado");
  return row;
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
    revalidatePath("/dashboard/plan");
    return;
  }
  if (status !== "done" && status !== "skipped") throw new Error("Estado inválido");

  const ctx = await loadPlanContext(userId);
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

  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
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
