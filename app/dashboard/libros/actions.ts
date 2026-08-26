"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  books,
  bookChapters,
  bookCharacters,
  bookScenarios,
  bookNotes,
} from "@/lib/db/schema/libros";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function requireBookOwnership(bookId: string, userId: string) {
  const [book] = await db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .limit(1);
  if (!book) throw new Error("Libro no encontrado");
}

export async function createBook(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  const author = String(formData.get("author") || "").trim() || null;
  const status = String(formData.get("status") || "leyendo");

  if (!title) throw new Error("El título es obligatorio");
  if (!["leyendo", "terminado", "pendiente"].includes(status)) {
    throw new Error("Estado inválido");
  }

  await db.insert(books).values({ userId, title, author, status });

  revalidatePath("/dashboard/libros");
}

export async function updateBookStatus(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "leyendo");

  await db
    .update(books)
    .set({ status })
    .where(and(eq(books.id, id), eq(books.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function deleteBook(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(books).where(and(eq(books.id, id), eq(books.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function createChapter(formData: FormData) {
  const userId = await requireUserId();
  const bookId = String(formData.get("bookId") || "");
  const number = Number(formData.get("number"));
  const title = String(formData.get("title") || "").trim() || null;
  const summary = String(formData.get("summary") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!number) throw new Error("El número de capítulo es obligatorio");
  await requireBookOwnership(bookId, userId);

  await db.insert(bookChapters).values({ userId, bookId, number, title, summary, notes });

  revalidatePath("/dashboard/libros");
}

export async function updateChapterNotes(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const notes = String(formData.get("notes") || "");

  await db
    .update(bookChapters)
    .set({ notes: notes || null })
    .where(and(eq(bookChapters.id, id), eq(bookChapters.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function deleteChapter(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(bookChapters)
    .where(and(eq(bookChapters.id, id), eq(bookChapters.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function createCharacter(formData: FormData) {
  const userId = await requireUserId();
  const bookId = String(formData.get("bookId") || "");
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;

  if (!name) throw new Error("El nombre es obligatorio");
  await requireBookOwnership(bookId, userId);

  await db.insert(bookCharacters).values({ userId, bookId, name, role, description });

  revalidatePath("/dashboard/libros");
}

export async function deleteCharacter(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(bookCharacters)
    .where(and(eq(bookCharacters.id, id), eq(bookCharacters.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function createScenario(formData: FormData) {
  const userId = await requireUserId();
  const bookId = String(formData.get("bookId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  if (!title) throw new Error("El título es obligatorio");
  await requireBookOwnership(bookId, userId);

  await db.insert(bookScenarios).values({ userId, bookId, title, description });

  revalidatePath("/dashboard/libros");
}

export async function updateScenario(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const description = String(formData.get("description") || "");
  const notes = String(formData.get("notes") || "");

  await db
    .update(bookScenarios)
    .set({ description: description || null, notes: notes || null })
    .where(and(eq(bookScenarios.id, id), eq(bookScenarios.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function deleteScenario(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(bookScenarios)
    .where(and(eq(bookScenarios.id, id), eq(bookScenarios.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function createNote(formData: FormData) {
  const userId = await requireUserId();
  const bookId = String(formData.get("bookId") || "");
  const title = String(formData.get("title") || "").trim() || null;
  const content = String(formData.get("content") || "").trim() || null;

  await requireBookOwnership(bookId, userId);

  await db.insert(bookNotes).values({ userId, bookId, title, content });

  revalidatePath("/dashboard/libros");
}

export async function updateNote(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim() || null;
  const content = String(formData.get("content") || "");

  await db
    .update(bookNotes)
    .set({ title, content: content || null })
    .where(and(eq(bookNotes.id, id), eq(bookNotes.userId, userId)));

  revalidatePath("/dashboard/libros");
}

export async function deleteNote(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(bookNotes).where(and(eq(bookNotes.id, id), eq(bookNotes.userId, userId)));

  revalidatePath("/dashboard/libros");
}
