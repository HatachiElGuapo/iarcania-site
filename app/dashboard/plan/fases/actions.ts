"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
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

// Reescribe TODA la lista de una cola para una fase (o global, si
// phaseId viene vacío) a partir de un textarea, una tarea por línea.
// Líneas vacías se descartan; el orden final es el orden del textarea.
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
