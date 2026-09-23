"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts, scriptSlides } from "@/lib/db/schema/guiones";
import { isSlideTipo, type SlideDraft } from "@/lib/guiones/slides";

export type SlideRow = typeof scriptSlides.$inferSelect;
type Result = { ok: true; slides: SlideRow[] } | { ok: false; error: string };

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function assertOwner(scriptId: string, userId: string) {
  const [row] = await db
    .select({ id: scripts.id })
    .from(scripts)
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Guión no encontrado");
}

function ordered(scriptId: string) {
  return db
    .select()
    .from(scriptSlides)
    .where(eq(scriptSlides.scriptId, scriptId))
    .orderBy(asc(scriptSlides.orden));
}

// Re-normaliza `orden` a 0..n-1 según el array recibido.
async function renumber(scriptId: string, rows: { id: string }[]) {
  await Promise.all(
    rows.map((r, i) =>
      db
        .update(scriptSlides)
        .set({ orden: i })
        .where(eq(scriptSlides.id, r.id)),
    ),
  );
}

function done(scriptId: string, slides: SlideRow[]): Result {
  revalidatePath("/dashboard/guiones");
  revalidatePath(`/dashboard/guiones/${scriptId}/presentar`);
  return { ok: true, slides };
}

export async function getSlides(scriptId: string): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);
    return { ok: true, slides: await ordered(scriptId) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addSlide(
  scriptId: string,
  input: SlideDraft,
): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);
    if (!isSlideTipo(input.tipo)) throw new Error("Tipo de slide inválido");
    const principal = (input.textoPrincipal || "").trim();
    if (!principal) throw new Error("El texto principal es obligatorio");

    const current = await ordered(scriptId);
    await db.insert(scriptSlides).values({
      scriptId,
      userId,
      orden: current.length,
      tipo: input.tipo,
      textoPrincipal: principal,
      textoSecundario: input.textoSecundario?.trim() || null,
      notas: input.notas?.trim() || null,
    });
    return done(scriptId, await ordered(scriptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSlide(
  scriptId: string,
  slideId: string,
  patch: Partial<SlideDraft>,
): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);

    const set: Partial<SlideRow> = {};
    if (patch.tipo !== undefined) {
      if (!isSlideTipo(patch.tipo)) throw new Error("Tipo de slide inválido");
      set.tipo = patch.tipo;
    }
    if (patch.textoPrincipal !== undefined) {
      const p = patch.textoPrincipal.trim();
      if (!p) throw new Error("El texto principal es obligatorio");
      set.textoPrincipal = p;
    }
    if (patch.textoSecundario !== undefined)
      set.textoSecundario = patch.textoSecundario?.trim() || null;
    if (patch.notas !== undefined) set.notas = patch.notas?.trim() || null;

    await db
      .update(scriptSlides)
      .set(set)
      .where(
        and(eq(scriptSlides.id, slideId), eq(scriptSlides.scriptId, scriptId)),
      );
    return done(scriptId, await ordered(scriptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSlide(
  scriptId: string,
  slideId: string,
): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);
    await db
      .delete(scriptSlides)
      .where(
        and(eq(scriptSlides.id, slideId), eq(scriptSlides.scriptId, scriptId)),
      );
    const rows = await ordered(scriptId);
    await renumber(scriptId, rows);
    return done(scriptId, await ordered(scriptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moveSlide(
  scriptId: string,
  slideId: string,
  dir: -1 | 1,
): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);
    const rows = await ordered(scriptId);
    const i = rows.findIndex((r) => r.id === slideId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return done(scriptId, rows);
    [rows[i], rows[j]] = [rows[j], rows[i]];
    await renumber(scriptId, rows);
    return done(scriptId, await ordered(scriptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Reemplaza TODOS los slides del guión (lo que usa "✨ Generar slides").
export async function replaceSlides(
  scriptId: string,
  drafts: SlideDraft[],
): Promise<Result> {
  try {
    const userId = await requireUserId();
    await assertOwner(scriptId, userId);

    const clean = drafts
      .filter((d) => isSlideTipo(d.tipo) && (d.textoPrincipal || "").trim())
      .map((d, i) => ({
        scriptId,
        userId,
        orden: i,
        tipo: d.tipo,
        textoPrincipal: d.textoPrincipal.trim(),
        textoSecundario: d.textoSecundario?.trim() || null,
        notas: d.notas?.trim() || null,
      }));

    await db.delete(scriptSlides).where(eq(scriptSlides.scriptId, scriptId));
    if (clean.length) await db.insert(scriptSlides).values(clean);
    return done(scriptId, await ordered(scriptId));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
