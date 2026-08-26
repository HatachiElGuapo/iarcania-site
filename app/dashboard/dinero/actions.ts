"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts, expenses, income } from "@/lib/db/schema/dinero";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createAccount(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const icon = String(formData.get("icon") || "").trim() || null;
  const balance = formData.get("balance") ? Number(formData.get("balance")) : 0;

  if (!name) throw new Error("El nombre de la cuenta es obligatorio");

  await db.insert(financialAccounts).values({ userId, name, icon, balance });

  revalidatePath("/dashboard/dinero/cuentas");
}

// Un movimiento SIEMPRE crea una fila en expenses/income y, si viene con
// accountId, ajusta el saldo de esa cuenta en la misma transacción — mismo
// comportamiento que saveMovimiento() en el os.js original.
export async function recordMovement(formData: FormData) {
  const userId = await requireUserId();
  const kind = String(formData.get("kind") || "");
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") || "");
  const description = String(formData.get("description") || "").trim() || null;
  const accountId = String(formData.get("accountId") || "") || null;

  if (!["gasto", "ingreso"].includes(kind)) throw new Error("Tipo inválido");
  if (!amount || amount <= 0) throw new Error("Monto inválido");

  await db.transaction(async (tx) => {
    if (accountId) {
      const [account] = await tx
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
        .limit(1);
      if (!account) throw new Error("Cuenta no encontrada");
    }

    if (kind === "gasto") {
      const category = String(formData.get("category") || "otros");
      await tx
        .insert(expenses)
        .values({ userId, amount, category, description, date, accountId });
      if (accountId) {
        await tx
          .update(financialAccounts)
          .set({ balance: sql`${financialAccounts.balance} - ${amount}` })
          .where(eq(financialAccounts.id, accountId));
      }
    } else {
      const source = String(formData.get("source") || "otro");
      await tx
        .insert(income)
        .values({ userId, amount, source, description, date, accountId });
      if (accountId) {
        await tx
          .update(financialAccounts)
          .set({ balance: sql`${financialAccounts.balance} + ${amount}` })
          .where(eq(financialAccounts.id, accountId));
      }
    }
  });

  revalidatePath("/dashboard/dinero/cuentas");
  revalidatePath("/dashboard/dinero/gastos");
}

export async function deleteExpense(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

  revalidatePath("/dashboard/dinero/gastos");
}

export async function deleteIncome(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .delete(income)
    .where(and(eq(income.id, id), eq(income.userId, userId)));

  revalidatePath("/dashboard/dinero/gastos");
}
