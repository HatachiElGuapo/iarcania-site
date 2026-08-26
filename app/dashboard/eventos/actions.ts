"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { eventTypes, eventOccurrences } from "@/lib/db/schema/eventos";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

const DEFAULT_EVENT_TYPES: { category: string; name: string; description: string }[] = [
  { category: "cultural", name: "Cine", description: "Película en sala" },
  { category: "cultural", name: "Concierto", description: "Show en vivo — música" },
  { category: "cultural", name: "Teatro / Stand up", description: "Obra, comedia o show en escenario" },
  { category: "cultural", name: "Museo / Exposición", description: "Arte, ciencia o historia" },
  { category: "amigos", name: "Salida con amigos", description: "Plan informal con el grupo" },
  { category: "amigos", name: "Fiesta / Rumba", description: "Celebración o noche de rumba" },
  { category: "amigos", name: "Videollamada grupal", description: "Cuando la distancia manda" },
  { category: "familia", name: "Reunión familiar", description: "Toda la familia junta" },
  { category: "familia", name: "Cena en familia", description: "Comida especial en casa o restaurante" },
  { category: "familia", name: "Visita a familiares", description: "Ir a ver a alguien de la familia" },
  { category: "visita", name: "Restaurante nuevo", description: "Probar un lugar por primera vez" },
  { category: "visita", name: "Café de trabajo", description: "Sesión de trabajo fuera de casa" },
  { category: "visita", name: "Viaje / Escapada", description: "Salir de la ciudad aunque sea un día" },
  { category: "visita", name: "Bar / Tertulia", description: "Conversación tranquila con algo de tomar" },
];

export async function seedEventTypeDefaults() {
  const userId = await requireUserId();

  await db
    .insert(eventTypes)
    .values(DEFAULT_EVENT_TYPES.map((d) => ({ ...d, userId })));

  revalidatePath("/dashboard/eventos");
}

export async function saveEventType(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "visita");
  const description = String(formData.get("description") || "").trim() || null;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!["cultural", "amigos", "familia", "visita"].includes(category)) {
    throw new Error("Categoría inválida");
  }

  if (id) {
    await db
      .update(eventTypes)
      .set({ name, category, description })
      .where(and(eq(eventTypes.id, id), eq(eventTypes.userId, userId)));
  } else {
    await db.insert(eventTypes).values({ userId, name, category, description });
  }

  revalidatePath("/dashboard/eventos");
}

export async function deleteEventType(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(eventTypes)
    .where(and(eq(eventTypes.id, id), eq(eventTypes.userId, userId)));

  revalidatePath("/dashboard/eventos");
}

export async function saveOccurrence(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const eventTypeId = String(formData.get("eventTypeId") || "");
  const date = String(formData.get("date") || "");
  const cost = formData.get("cost") ? Number(formData.get("cost")) : null;
  const people = String(formData.get("people") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const mood = String(formData.get("mood") || "") || null;

  if (!date) throw new Error("La fecha es obligatoria");
  if (mood && !["genial", "normal", "dificil"].includes(mood)) {
    throw new Error("Mood inválido");
  }

  if (id) {
    await db
      .update(eventOccurrences)
      .set({ date, cost, people, location, notes, mood })
      .where(and(eq(eventOccurrences.id, id), eq(eventOccurrences.userId, userId)));
  } else {
    const [type] = await db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.userId, userId)))
      .limit(1);
    if (!type) throw new Error("Tipo de evento no encontrado");

    await db.insert(eventOccurrences).values({
      eventTypeId,
      userId,
      date,
      cost,
      people,
      location,
      notes,
      mood,
    });
  }

  revalidatePath("/dashboard/eventos");
}

export async function deleteOccurrence(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(eventOccurrences)
    .where(and(eq(eventOccurrences.id, id), eq(eventOccurrences.userId, userId)));

  revalidatePath("/dashboard/eventos");
}
