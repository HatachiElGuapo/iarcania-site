"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, projects, payments, invoices } from "@/lib/db/schema/clientes";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createClient(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const business = String(formData.get("business") || "").trim() || null;
  const service = String(formData.get("service") || "").trim() || null;

  if (!name) throw new Error("El nombre es obligatorio");

  await db.insert(clients).values({ userId, name, business, service });

  revalidatePath("/dashboard/clientes");
}

export async function updateClientStatus(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "activo");

  if (!["activo", "inactivo", "pausado"].includes(status)) {
    throw new Error("Estado inválido");
  }

  await db
    .update(clients)
    .set({ status })
    .where(and(eq(clients.id, id), eq(clients.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function deleteClient(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function createProject(formData: FormData) {
  const userId = await requireUserId();
  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!name) throw new Error("El nombre del proyecto es obligatorio");

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado");

  await db.insert(projects).values({ userId, clientId, name });

  revalidatePath("/dashboard/clientes");
}

export async function completeProjectClient(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(projects)
    .set({ status: "completado" })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function createPayment(formData: FormData) {
  const userId = await requireUserId();
  const clientId = String(formData.get("clientId") || "");
  const amount = Number(formData.get("amount"));
  const status = String(formData.get("status") || "pendiente");
  const dueDate = String(formData.get("dueDate") || "") || null;
  const paidDate = String(formData.get("paidDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!amount || amount <= 0) throw new Error("Monto inválido");
  if (!["pagado", "pendiente", "vencido"].includes(status)) {
    throw new Error("Estado inválido");
  }

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado");

  await db.insert(payments).values({
    userId,
    clientId,
    amount,
    status,
    dueDate,
    paidDate: status === "pagado" ? paidDate : null,
    notes,
  });

  revalidatePath("/dashboard/clientes");
}

export async function markPaymentPaid(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const paidDate = String(formData.get("paidDate") || "");

  await db
    .update(payments)
    .set({ status: "pagado", paidDate })
    .where(and(eq(payments.id, id), eq(payments.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function deletePayment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(payments).where(and(eq(payments.id, id), eq(payments.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function createInvoice(formData: FormData) {
  const userId = await requireUserId();
  const clientId = String(formData.get("clientId") || "");
  const amount = Number(formData.get("amount"));
  const dueDate = String(formData.get("dueDate") || "");
  const description = String(formData.get("description") || "").trim() || null;

  if (!amount || amount <= 0) throw new Error("Monto inválido");
  if (!dueDate) throw new Error("La fecha de vencimiento es obligatoria");

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado");

  await db.insert(invoices).values({ userId, clientId, amount, dueDate, description });

  revalidatePath("/dashboard/clientes");
}

export async function markInvoicePaid(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(invoices)
    .set({ status: "pagado" })
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

  revalidatePath("/dashboard/clientes");
}

export async function deleteInvoice(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

  revalidatePath("/dashboard/clientes");
}
