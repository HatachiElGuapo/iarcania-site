"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { marcoDocuments } from "@/lib/db/schema/marco";
import { applyDictionary, autocolorBlock } from "@/lib/marco/autocolor";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function updateMarcoDocument(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  // El énfasis se aplica solo al guardar: se escribe la frase en texto plano
  // (o con marcas {color:x}/{-:x}) y el diccionario materializa el resto.
  // Ver lib/marco/color-dictionary.ts.
  const content = autocolorBlock(String(formData.get("content") || ""));
  const introRaw = String(formData.get("intro") || "").trim();
  const intro = introRaw ? applyDictionary(introRaw) : null;

  if (!content.trim()) throw new Error("El contenido no puede estar vacío");

  await db
    .update(marcoDocuments)
    .set({ content, intro, updatedAt: new Date() })
    .where(and(eq(marcoDocuments.id, id), eq(marcoDocuments.userId, userId)));

  revalidatePath("/dashboard/marco");
}
