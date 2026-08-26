"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { courses, lessons, students } from "@/lib/db/schema/escuela";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

async function requireCourseOwnership(courseId: string, userId: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);
  if (!course) throw new Error("Curso no encontrado");
}

export async function createCourse(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const canal = String(formData.get("canal") || "iarcania");
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim() || null;
  const orden = Number(formData.get("orden")) || 0;

  if (!title) throw new Error("El título es obligatorio");

  await db.insert(courses).values({ userId, title, description, canal, thumbnailUrl, orden });

  revalidatePath("/dashboard/escuela");
}

export async function updateCourse(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const canal = String(formData.get("canal") || "iarcania");
  const active = formData.get("active") === "true";
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim() || null;
  const orden = Number(formData.get("orden")) || 0;

  if (!title) throw new Error("El título es obligatorio");

  await db
    .update(courses)
    .set({ title, description, canal, active, thumbnailUrl, orden })
    .where(and(eq(courses.id, id), eq(courses.userId, userId)));

  revalidatePath("/dashboard/escuela");
}

export async function deleteCourse(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(courses).where(and(eq(courses.id, id), eq(courses.userId, userId)));

  revalidatePath("/dashboard/escuela");
}

export async function createLesson(formData: FormData) {
  const userId = await requireUserId();
  const courseId = String(formData.get("courseId") || "");
  const title = String(formData.get("title") || "").trim();
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  const tierRequired = String(formData.get("tierRequired") || "gratis");
  const durationMin = formData.get("durationMin") ? Number(formData.get("durationMin")) : null;
  const orden = Number(formData.get("orden")) || 0;

  if (!title) throw new Error("El título es obligatorio");
  await requireCourseOwnership(courseId, userId);

  await db
    .insert(lessons)
    .values({ userId, courseId, title, videoUrl, tierRequired, durationMin, orden });

  revalidatePath("/dashboard/escuela");
}

export async function updateLesson(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  const tierRequired = String(formData.get("tierRequired") || "gratis");
  const durationMin = formData.get("durationMin") ? Number(formData.get("durationMin")) : null;
  const orden = Number(formData.get("orden")) || 0;

  if (!title) throw new Error("El título es obligatorio");

  await db
    .update(lessons)
    .set({ title, videoUrl, tierRequired, durationMin, orden })
    .where(and(eq(lessons.id, id), eq(lessons.userId, userId)));

  revalidatePath("/dashboard/escuela");
}

export async function deleteLesson(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(lessons).where(and(eq(lessons.id, id), eq(lessons.userId, userId)));

  revalidatePath("/dashboard/escuela");
}

// El select del formulario ofrece 'founder' como opción visual — se
// traduce a tier='pro' + isFounder=true, igual que el original.
export async function changeStudentTier(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const selected = String(formData.get("tier") || "");
  if (!selected) return;

  const isFounder = selected === "founder";
  const tier = isFounder ? "pro" : selected;

  await db
    .update(students)
    .set({ tier, isFounder })
    .where(and(eq(students.id, id), eq(students.userId, userId)));

  revalidatePath("/dashboard/escuela");
}
