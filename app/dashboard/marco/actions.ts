"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { marcoDocuments } from "@/lib/db/schema/marco";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function updateMarcoDocument(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const content = String(formData.get("content") || "");
  const intro = String(formData.get("intro") || "").trim() || null;

  if (!content.trim()) throw new Error("El contenido no puede estar vacío");

  await db
    .update(marcoDocuments)
    .set({ content, intro, updatedAt: new Date() })
    .where(and(eq(marcoDocuments.id, id), eq(marcoDocuments.userId, userId)));

  revalidatePath("/dashboard/marco");
}
