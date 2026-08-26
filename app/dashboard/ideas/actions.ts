"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ideas } from "@/lib/db/schema/ideas";
import { tasks } from "@/lib/db/schema/trabajo";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createIdea(formData: FormData) {
  const userId = await requireUserId();
  const rawContent = String(formData.get("rawContent") || "").trim();
  const category = String(formData.get("category") || "") || null;

  if (!rawContent) throw new Error("La idea no puede estar vacía");

  await db.insert(ideas).values({ userId, rawContent, category });

  revalidatePath("/dashboard/ideas");
}

export async function deleteIdea(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(ideas).where(and(eq(ideas.id, id), eq(ideas.userId, userId)));

  revalidatePath("/dashboard/ideas");
}

// Equivalente a createTaskFromIdea() del original — allá abría un modal
// pre-llenado; aquí, sin sistema de modales, crea la tarea directo.
export async function createTaskFromIdea(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  const [idea] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .limit(1);
  if (!idea) throw new Error("Idea no encontrada");

  await db.insert(tasks).values({
    userId,
    title: (idea.processedContent || idea.rawContent).slice(0, 200),
    category: idea.category,
  });

  revalidatePath("/dashboard/ideas");
  revalidatePath("/dashboard/trabajo/tareas");
}
