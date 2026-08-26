"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bills, billPayments } from "@/lib/db/schema/facturas";
import { expenses, financialAccounts } from "@/lib/db/schema/dinero";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createBill(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const estimatedAmount = Number(formData.get("estimatedAmount"));
  const dueDay = Number(formData.get("dueDay"));
  const category = String(formData.get("category") || "").trim() || null;

  if (!name) throw new Error("El nombre de la factura es obligatorio");
  if (!estimatedAmount || estimatedAmount <= 0) {
    throw new Error("Monto estimado inválido");
  }
  if (!dueDay || dueDay < 1 || dueDay > 28) {
    throw new Error("El día de vencimiento debe estar entre 1 y 28");
  }

  await db
    .insert(bills)
    .values({ userId, name, estimatedAmount, dueDay, category });

  revalidatePath("/dashboard/dinero/facturas");
}

// Ruta única para pagar una factura o registrar un cargo extra — reemplaza
// las 3 rutas redundantes del os.js original (confirmarPagoFactura,
// pagarFacturaRapido, guardarPagoFactura), que hacían básicamente lo mismo.
//
// Un pago 'normal' además crea una fila en expenses (igual que el original,
// para que el gasto aparezca también en el ledger unificado de Gastos) y,
// si se eligió cuenta, descuenta su saldo — todo en una transacción.
export async function payBill(formData: FormData) {
  const userId = await requireUserId();
  const billId = String(formData.get("billId") || "");
  const type = String(formData.get("type") || "normal");
  const amount = Number(formData.get("amount"));
  const paidDate = String(formData.get("paidDate") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  const notesExtra =
    type === "cargo_extra"
      ? String(formData.get("notesExtra") || "").trim() || null
      : null;
  const accountId = String(formData.get("accountId") || "") || null;

  if (!["normal", "cargo_extra"].includes(type)) {
    throw new Error("Tipo de pago inválido");
  }
  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.userId, userId)))
    .limit(1);
  if (!bill) throw new Error("Factura no encontrada");

  await db.transaction(async (tx) => {
    if (accountId) {
      const [account] = await tx
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.id, accountId),
            eq(financialAccounts.userId, userId),
          ),
        )
        .limit(1);
      if (!account) throw new Error("Cuenta no encontrada");
    }

    await tx.insert(billPayments).values({
      billId,
      userId,
      amount,
      paidDate,
      type,
      notes,
      notesExtra,
      accountId,
    });

    await tx.insert(expenses).values({
      userId,
      amount,
      category: bill.category || "servicios",
      description:
        type === "cargo_extra"
          ? `Cargo extra: ${bill.name}`
          : `Factura: ${bill.name}`,
      date: paidDate,
      accountId,
    });

    if (accountId) {
      await tx
        .update(financialAccounts)
        .set({ balance: sql`${financialAccounts.balance} - ${amount}` })
        .where(eq(financialAccounts.id, accountId));
    }
  });

  revalidatePath("/dashboard/dinero/facturas");
  revalidatePath("/dashboard/dinero/gastos");
  revalidatePath("/dashboard/dinero/cuentas");
}
