"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { plans, planBlocks } from "@/lib/db/schema/plan";
import { PLAN_KINDS } from "@/lib/plan/kinds";

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
  revalidatePath("/dashboard/plan/semana");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/plan/historial");
}

function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) throw new Error("Hora inválida");
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Crea (o edita, si viene "id") un bloque. Al crear, "extraWeekdays" permite
// que el mismo bloque quede también en otros días de la semana ("también en
// estos días" de la spec) — cada día es una fila independiente.
export async function upsertBlock(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);

  const id = String(formData.get("id") || "") || null;
  const personId = String(formData.get("personId") || "");
  const weekday = Number(formData.get("weekday"));
  const startTime = normalizeTime(String(formData.get("startTime") || ""));
  const endTimeRaw = String(formData.get("endTime") || "").trim();
  const endTime = endTimeRaw ? normalizeTime(endTimeRaw) : null;
  const text = String(formData.get("text") || "").trim();
  const kind = String(formData.get("kind") || "");
  const queueId = String(formData.get("queueId") || "") || null;
  const tentative = formData.get("tentative") === "on";
  const isMinimum = formData.get("isMinimum") === "on";
  const holidayText = String(formData.get("holidayText") || "").trim() || null;

  if (!personId) throw new Error("Falta la persona");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Día inválido");
  if (!text) throw new Error("El texto es obligatorio");
  if (!(kind in PLAN_KINDS)) throw new Error("Tipo inválido");

  const values = {
    planId,
    personId,
    startTime,
    endTime,
    text,
    kind,
    tentative,
    isMinimum,
    queueId,
    holidayText,
  };

  if (id) {
    await db
      .update(planBlocks)
      .set(values)
      .where(and(eq(planBlocks.id, id), eq(planBlocks.planId, planId)));
  } else {
    const extraWeekdays = formData
      .getAll("extraWeekdays")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6 && n !== weekday);
    const weekdays = [weekday, ...new Set(extraWeekdays)];

    await db.insert(planBlocks).values(weekdays.map((wd) => ({ ...values, weekday: wd })));
  }

  revalidateAll();
}

export async function deleteBlock(formData: FormData) {
  const userId = await requireUserId();
  const planId = await requireOwnedPlanId(userId);
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Falta el bloque");

  await db.delete(planBlocks).where(and(eq(planBlocks.id, id), eq(planBlocks.planId, planId)));

  revalidateAll();
}
