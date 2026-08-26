"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { recursos, recursosSensibles } from "@/lib/db/schema/recursos";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session;
}

const VISIBLE_PARA_OPTIONS = ["admin", "employee", "family", "cliente", "estudiante"];

export async function createRecurso(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const titulo = String(formData.get("titulo") || "").trim();
  const tipo = String(formData.get("tipo") || "curso");
  const estado = String(formData.get("estado") || "vivo");
  const nivelMin = String(formData.get("nivelMin") || "").trim() || null;
  const contenido = String(formData.get("contenido") || "").trim() || null;
  const visiblePara = VISIBLE_PARA_OPTIONS.filter((r) => formData.get(`vp_${r}`) === "on");
  const sensible = String(formData.get("sensible") || "").trim() || null;

  if (!titulo) throw new Error("El título es obligatorio");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(recursos)
      .values({ userId, titulo, tipo, estado, nivelMin, contenido, visiblePara })
      .returning();

    if (session.user.role === "admin" && sensible) {
      await tx.insert(recursosSensibles).values({ recursoId: row.id, contenido: sensible });
    }
  });

  revalidatePath("/dashboard/recursos");
}

export async function updateRecurso(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const id = String(formData.get("id") || "");
  const titulo = String(formData.get("titulo") || "").trim();
  const tipo = String(formData.get("tipo") || "curso");
  const estado = String(formData.get("estado") || "vivo");
  const nivelMin = String(formData.get("nivelMin") || "").trim() || null;
  const contenido = String(formData.get("contenido") || "").trim() || null;
  const visiblePara = VISIBLE_PARA_OPTIONS.filter((r) => formData.get(`vp_${r}`) === "on");
  const sensible = String(formData.get("sensible") || "").trim() || null;

  if (!titulo) throw new Error("El título es obligatorio");

  const ownership =
    session.user.role === "admin"
      ? eq(recursos.id, id)
      : and(eq(recursos.id, id), eq(recursos.userId, userId));

  await db.transaction(async (tx) => {
    await tx
      .update(recursos)
      .set({ titulo, tipo, estado, nivelMin, contenido, visiblePara })
      .where(ownership);

    if (session.user.role === "admin") {
      await tx
        .insert(recursosSensibles)
        .values({ recursoId: id, contenido: sensible })
        .onConflictDoUpdate({
          target: recursosSensibles.recursoId,
          set: { contenido: sensible, updatedAt: new Date() },
        });
    }
  });

  revalidatePath("/dashboard/recursos");
}

export async function deleteRecurso(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const id = String(formData.get("id") || "");

  const ownership =
    session.user.role === "admin"
      ? eq(recursos.id, id)
      : and(eq(recursos.id, id), eq(recursos.userId, userId));

  await db.delete(recursos).where(ownership);

  revalidatePath("/dashboard/recursos");
}
