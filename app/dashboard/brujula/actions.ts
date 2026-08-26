"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lifeAreas, lifeProjects } from "@/lib/db/schema/brujula";
import { tasks } from "@/lib/db/schema/trabajo";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createArea(formData: FormData) {
  const userId = await requireUserId();
  const nombre = String(formData.get("nombre") || "").trim();
  const color = String(formData.get("color") || "#888888");
  const enfoqueActual = String(formData.get("enfoqueActual") || "").trim() || null;
  const filosofia = String(formData.get("filosofia") || "").trim() || null;

  if (!nombre) throw new Error("El nombre del área es obligatorio");

  await db.insert(lifeAreas).values({ userId, nombre, color, enfoqueActual, filosofia });

  revalidatePath("/dashboard/brujula");
}

export async function updateArea(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const color = String(formData.get("color") || "#888888");
  const enfoqueActual = String(formData.get("enfoqueActual") || "").trim() || null;
  const filosofia = String(formData.get("filosofia") || "").trim() || null;

  if (!nombre) throw new Error("El nombre del área es obligatorio");

  await db
    .update(lifeAreas)
    .set({ nombre, color, enfoqueActual, filosofia })
    .where(and(eq(lifeAreas.id, id), eq(lifeAreas.userId, userId)));

  revalidatePath("/dashboard/brujula");
}

export async function deleteArea(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(lifeAreas)
    .where(and(eq(lifeAreas.id, id), eq(lifeAreas.userId, userId)));

  revalidatePath("/dashboard/brujula");
}

export async function createProject(formData: FormData) {
  const userId = await requireUserId();
  const areaId = String(formData.get("areaId") || "");
  const parentId = String(formData.get("parentId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  if (!name) throw new Error("El nombre es obligatorio");

  const [area] = await db
    .select({ id: lifeAreas.id })
    .from(lifeAreas)
    .where(and(eq(lifeAreas.id, areaId), eq(lifeAreas.userId, userId)))
    .limit(1);
  if (!area) throw new Error("Área no encontrada");

  await db.insert(lifeProjects).values({ userId, areaId, parentId, name, description });

  revalidatePath("/dashboard/brujula");
}

export async function completeProject(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(lifeProjects)
    .set({ status: "completado" })
    .where(and(eq(lifeProjects.id, id), eq(lifeProjects.userId, userId)));

  revalidatePath("/dashboard/brujula");
}

export async function createTaskInProject(formData: FormData) {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") || "");
  const areaId = String(formData.get("areaId") || "") || null;
  const title = String(formData.get("title") || "").trim();
  const dueDate = String(formData.get("dueDate") || "") || null;
  const priority = String(formData.get("priority") || "media");

  if (!title) throw new Error("El título es obligatorio");

  const [project] = await db
    .select({ id: lifeProjects.id })
    .from(lifeProjects)
    .where(and(eq(lifeProjects.id, projectId), eq(lifeProjects.userId, userId)))
    .limit(1);
  if (!project) throw new Error("Proyecto no encontrado");

  await db.insert(tasks).values({
    userId,
    title,
    projectId,
    areaId,
    dueDate,
    priority,
  });

  revalidatePath("/dashboard/brujula");
  revalidatePath("/dashboard/actividades");
  revalidatePath("/dashboard/trabajo/tareas");
}
