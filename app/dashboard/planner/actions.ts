"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts, scriptDerivados } from "@/lib/db/schema/guiones";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

// Campos exclusivos de Planner (formato, plataforma origen, fecha/hora de
// grabación y publicación) — separado de `updateScript` (Guiones) a
// propósito: el formulario de Guiones no envía estos campos, así que si
// compartieran una sola acción cada guardado desde Guiones los pisaría a
// vacío. Dos acciones, misma fila.
export async function updatePlannerFields(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const formato = String(formData.get("formato") || "Video largo");
  const plataformaOrigen = String(formData.get("plataformaOrigen") || "YouTube");
  const fechaGrabacion = String(formData.get("fechaGrabacion") || "").trim() || null;
  const horaGrab = String(formData.get("horaGrab") || "").trim() || null;
  const horaPub = String(formData.get("horaPub") || "").trim() || null;

  await db
    .update(scripts)
    .set({ formato, plataformaOrigen, fechaGrabacion, horaGrab, horaPub })
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/planner");
  revalidatePath("/dashboard/guiones");
}

async function requireScriptOwnership(scriptId: string, userId: string) {
  const [row] = await db
    .select({ id: scripts.id })
    .from(scripts)
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Guión no encontrado");
}

export async function createDerivado(formData: FormData) {
  const userId = await requireUserId();
  const scriptId = String(formData.get("scriptId") || "");
  const plataforma = String(formData.get("plataforma") || "");
  const formato = String(formData.get("formato") || "").trim() || null;
  const duracion = String(formData.get("duracion") || "").trim() || null;
  const notas = String(formData.get("notas") || "").trim() || null;

  if (!plataforma) throw new Error("La plataforma es obligatoria");
  await requireScriptOwnership(scriptId, userId);

  await db.insert(scriptDerivados).values({ userId, scriptId, plataforma, formato, duracion, notas });

  revalidatePath("/dashboard/planner");
}

export async function updateDerivadoEstado(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const estado = String(formData.get("estado") || "idea");

  await db
    .update(scriptDerivados)
    .set({ estado })
    .where(and(eq(scriptDerivados.id, id), eq(scriptDerivados.userId, userId)));

  revalidatePath("/dashboard/planner");
}

export async function deleteDerivado(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(scriptDerivados)
    .where(and(eq(scriptDerivados.id, id), eq(scriptDerivados.userId, userId)));

  revalidatePath("/dashboard/planner");
}
