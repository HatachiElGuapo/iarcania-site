"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createScript(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  const canal = String(formData.get("canal") || "iarcania");
  const hook = String(formData.get("hook") || "").trim() || null;
  const body = String(formData.get("body") || "").trim() || null;
  const cta = String(formData.get("cta") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!title) throw new Error("El título es obligatorio");

  await db.insert(scripts).values({ userId, title, canal, hook, body, cta, notes });

  revalidatePath("/dashboard/guiones");
}

export async function updateScript(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const status = String(formData.get("status") || "borrador");
  const hook = String(formData.get("hook") || "").trim() || null;
  const body = String(formData.get("body") || "").trim() || null;
  const cta = String(formData.get("cta") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const fechaGrabacion = String(formData.get("fechaGrabacion") || "").trim() || null;
  const fechaPublicacionRaw = String(formData.get("fechaPublicacion") || "").trim();
  const fechaPublicacion = fechaPublicacionRaw ? new Date(fechaPublicacionRaw) : null;

  if (!title) throw new Error("El título es obligatorio");

  await db
    .update(scripts)
    .set({ title, status, hook, body, cta, notes, fechaGrabacion, fechaPublicacion })
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/guiones");
}

export async function deleteScript(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(scripts).where(and(eq(scripts.id, id), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/guiones");
}

const CHECKLIST_ORDER = ["borrador", "en_progreso", "listo_grabar", "grabado", "publicado"];
const CHECKLIST_AUTO_STATUS: Record<string, string> = {
  guion: "en_progreso",
  grabado: "grabado",
  publicado: "publicado",
};
const CHECKLIST_KEYS = ["guion", "imagenes", "grabado", "editado", "thumbnail", "publicado"];

export async function toggleChecklist(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const key = String(formData.get("key") || "");
  const value = formData.get("value") === "true";
  if (!CHECKLIST_KEYS.includes(key)) throw new Error("Ítem de checklist inválido");

  const [script] = await db
    .select({ checklist: scripts.checklist, status: scripts.status })
    .from(scripts)
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)))
    .limit(1);
  if (!script) throw new Error("Guión no encontrado");

  const checklist = { ...(script.checklist as Record<string, boolean>), [key]: value };

  const updates: { checklist: Record<string, boolean>; status?: string } = { checklist };
  const autoStatus = CHECKLIST_AUTO_STATUS[key];
  if (value && autoStatus) {
    const curIdx = CHECKLIST_ORDER.indexOf(script.status);
    const newIdx = CHECKLIST_ORDER.indexOf(autoStatus);
    if (newIdx > curIdx) updates.status = autoStatus;
  }

  await db
    .update(scripts)
    .set(updates)
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/guiones");
}

export async function savePublicacion(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  const plataformas = formData.getAll("plataformas").map(String);
  const copyYtTitulo = String(formData.get("copyYtTitulo") || "").trim() || null;
  const copyYtDescripcion = String(formData.get("copyYtDescripcion") || "").trim() || null;
  const copyIgCaption = String(formData.get("copyIgCaption") || "").trim() || null;

  await db
    .update(scripts)
    .set({ videoUrl, plataformas, copyYtTitulo, copyYtDescripcion, copyIgCaption })
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/guiones");
}

type PresView = { html: string; filename: string };
type PresData = { presentador?: PresView; audiencia?: PresView; generado_en?: string };

export async function savePresData(scriptId: string, presData: PresData) {
  const userId = await requireUserId();

  await db
    .update(scripts)
    .set({ presData })
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)));

  revalidatePath("/dashboard/guiones");
}
