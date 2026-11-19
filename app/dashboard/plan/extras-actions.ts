"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { requireOwnedBlock } from "./actions";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function revalidateAll() {
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function validateRange(timeDue: string | null, timeEnd: string | null) {
  if (timeDue && timeEnd && toMinutes(timeEnd) <= toMinutes(timeDue)) {
    throw new Error("La hora de fin debe ser mayor que la de inicio");
  }
}

// "Agregar solo hoy" de un bloque — a diferencia de "Agregar subhábito"
// (permanente, crea una activity que vuelve todos los días que el bloque
// toque), esto es una task suelta con due_date = `date` y
// plan_block_id = `blockId`: vive y se muestra SOLO ese día, adentro del
// árbol del bloque (ver lib/plan/extras.ts / day-events.ts, que la
// excluye de la lista general de Tu día).
export async function addPlanExtra(formData: FormData) {
  const userId = await requireUserId();
  const blockId = String(formData.get("blockId") || "");
  const date = String(formData.get("date") || "");
  const title = String(formData.get("title") || "").trim();
  const timeDue = String(formData.get("timeDue") || "") || null;
  const timeEnd = String(formData.get("timeEnd") || "") || null;
  if (!blockId || !date || !title) throw new Error("Faltan datos");
  validateRange(timeDue, timeEnd);

  await requireOwnedBlock(blockId, userId);

  await db.insert(tasks).values({ userId, title, dueDate: date, timeDue, timeEnd, planBlockId: blockId });

  revalidateAll();
}
