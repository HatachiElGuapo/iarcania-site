"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agencyClients, agencyPayments } from "@/lib/db/schema/agencia";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createAgencyClient(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const business = String(formData.get("business") || "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const service = String(formData.get("service") || "").trim() || null;
  const monthlyAmount = Number(formData.get("monthlyAmount")) || 0;

  if (!name) throw new Error("El nombre es obligatorio");

  await db.insert(agencyClients).values({
    userId,
    name,
    business,
    whatsapp,
    email,
    service,
    monthlyAmount,
    startDate: new Date().toISOString().slice(0, 10),
  });

  revalidatePath("/dashboard/dinero/cobros");
}

export async function updateAgencyClientStatus(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "activo");

  if (!["activo", "inactivo", "pausado"].includes(status)) throw new Error("Estado inválido");

  await db
    .update(agencyClients)
    .set({ status })
    .where(and(eq(agencyClients.id, id), eq(agencyClients.userId, userId)));

  revalidatePath("/dashboard/dinero/cobros");
}

export async function deleteAgencyClient(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(agencyClients).where(and(eq(agencyClients.id, id), eq(agencyClients.userId, userId)));

  revalidatePath("/dashboard/dinero/cobros");
}

export async function createAgencyPayment(formData: FormData) {
  const userId = await requireUserId();
  const clientId = String(formData.get("clientId") || "");
  const amount = Number(formData.get("amount"));
  const status = String(formData.get("status") || "pendiente");
  const dueDate = String(formData.get("dueDate") || "") || null;
  const paidDate = String(formData.get("paidDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!clientId) throw new Error("Selecciona un cliente");
  if (!amount || amount <= 0) throw new Error("Monto inválido");
  if (!["pendiente", "pagado", "vencido"].includes(status)) throw new Error("Estado inválido");

  const [client] = await db
    .select({ id: agencyClients.id })
    .from(agencyClients)
    .where(and(eq(agencyClients.id, clientId), eq(agencyClients.userId, userId)))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado");

  await db.insert(agencyPayments).values({
    userId,
    clientId,
    amount,
    status,
    dueDate,
    paidDate: status === "pagado" ? paidDate : null,
    notes,
  });

  revalidatePath("/dashboard/dinero/cobros");
}

export async function markAgencyPaymentPaid(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const paidDate = String(formData.get("paidDate") || "");

  await db
    .update(agencyPayments)
    .set({ status: "pagado", paidDate })
    .where(and(eq(agencyPayments.id, id), eq(agencyPayments.userId, userId)));

  revalidatePath("/dashboard/dinero/cobros");
}

export async function deleteAgencyPayment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(agencyPayments).where(and(eq(agencyPayments.id, id), eq(agencyPayments.userId, userId)));

  revalidatePath("/dashboard/dinero/cobros");
}
