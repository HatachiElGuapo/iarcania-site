"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { personalDebts } from "@/lib/db/schema/dinero";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createDebt(formData: FormData) {
  const userId = await requireUserId();
  const creditor = String(formData.get("creditor") || "").trim();
  const totalAmount = Number(formData.get("totalAmount"));
  const monthlyPaymentRaw = String(formData.get("monthlyPayment") || "").trim();
  const monthlyPayment = monthlyPaymentRaw ? Number(monthlyPaymentRaw) : null;
  const dueDate = String(formData.get("dueDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!creditor) throw new Error("El acreedor es obligatorio");
  if (!totalAmount || totalAmount <= 0) throw new Error("Monto total inválido");
  if (monthlyPayment !== null && (Number.isNaN(monthlyPayment) || monthlyPayment <= 0)) {
    throw new Error("Cuota mensual inválida");
  }

  await db.insert(personalDebts).values({
    userId,
    creditor,
    totalAmount,
    remainingAmount: totalAmount,
    monthlyPayment,
    dueDate,
    notes,
  });

  revalidatePath("/dashboard/dinero/deudas");
}

export async function makePayment(formData: FormData) {
  const userId = await requireUserId();
  const debtId = String(formData.get("debtId") || "");
  const amount = Number(formData.get("amount"));

  if (!debtId) throw new Error("Falta la deuda");
  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const [debt] = await db
    .select()
    .from(personalDebts)
    .where(and(eq(personalDebts.id, debtId), eq(personalDebts.userId, userId)))
    .limit(1);
  if (!debt) throw new Error("Deuda no encontrada");

  const next = debt.remainingAmount - amount;
  const remainingAmount = next <= 0 ? 0 : next;
  const status = next <= 0 ? "paid" : debt.status;

  await db
    .update(personalDebts)
    .set({ remainingAmount, status })
    .where(and(eq(personalDebts.id, debtId), eq(personalDebts.userId, userId)));

  revalidatePath("/dashboard/dinero/deudas");
}

export async function deleteDebt(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(personalDebts)
    .where(and(eq(personalDebts.id, id), eq(personalDebts.userId, userId)));

  revalidatePath("/dashboard/dinero/deudas");
}
