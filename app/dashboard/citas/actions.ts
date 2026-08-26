"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { appointments } from "@/lib/db/schema/citas";
import { agendaItems } from "@/lib/db/schema/agenda";
import { BOGOTA_OFFSET } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function slotTimeFrom(datePart: string, timePart: string) {
  const [hh, mm] = timePart.split(":").map(Number);
  const totalMin = Math.round((hh * 60 + mm) / 10) * 10;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return {
    date: datePart,
    blockTime: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
}

export async function createAppointment(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "otro");
  const dtLocal = String(formData.get("datetime") || "");
  const durationMinutes = Number(formData.get("durationMinutes")) || 60;
  const travelBeforeMinutes = formData.get("travelBeforeMinutes")
    ? Number(formData.get("travelBeforeMinutes"))
    : null;
  const travelAfterMinutes = formData.get("travelAfterMinutes")
    ? Number(formData.get("travelAfterMinutes"))
    : null;
  const location = String(formData.get("location") || "").trim() || null;
  const doctorName = String(formData.get("doctorName") || "").trim() || null;
  const eventTypeId = String(formData.get("eventTypeId") || "") || null;
  const reminder1Hours = Number(formData.get("reminder1Hours")) || 0;
  const reminder2Hours = Number(formData.get("reminder2Hours")) || 0;

  if (!title || !dtLocal) throw new Error("Título y fecha son obligatorios");
  if (!["medica", "odontologica", "reunion", "otro"].includes(type)) {
    throw new Error("Tipo inválido");
  }

  const [datePart, timePart] = dtLocal.split("T");
  const datetime = new Date(`${dtLocal}:00${BOGOTA_OFFSET}`);
  const reminder1At =
    reminder1Hours > 0
      ? new Date(datetime.getTime() - reminder1Hours * 3600000)
      : null;
  const reminder2At =
    reminder2Hours > 0
      ? new Date(datetime.getTime() - reminder2Hours * 3600000)
      : null;

  await db.transaction(async (tx) => {
    const [appt] = await tx
      .insert(appointments)
      .values({
        userId,
        title,
        type,
        datetime,
        durationMinutes,
        travelBeforeMinutes,
        travelAfterMinutes,
        location,
        doctorName,
        eventTypeId,
        reminder1At,
        reminder2At,
      })
      .returning();

    const { date, blockTime } = slotTimeFrom(datePart, timePart);
    await tx
      .insert(agendaItems)
      .values({
        userId,
        date,
        blockTime,
        itemType: "cita",
        itemId: appt.id,
        duration: durationMinutes,
      })
      .onConflictDoNothing();
  });

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/agenda");
}

async function setStatusAndUnsync(id: string, userId: string, status: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status })
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));

    await tx
      .delete(agendaItems)
      .where(and(eq(agendaItems.itemId, id), eq(agendaItems.userId, userId)));
  });
}

export async function completeAppointment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  await setStatusAndUnsync(id, userId, "completada");
  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/agenda");
}

export async function cancelAppointment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  await setStatusAndUnsync(id, userId, "cancelada");
  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/agenda");
}

export async function deleteAppointment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.transaction(async (tx) => {
    await tx
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
    await tx
      .delete(agendaItems)
      .where(and(eq(agendaItems.itemId, id), eq(agendaItems.userId, userId)));
  });

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/agenda");
}
