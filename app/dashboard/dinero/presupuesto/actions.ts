"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { income, budgetCategories, budgetCategoryDistributions } from "@/lib/db/schema/dinero";
import { todayISO } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

const SOURCES = ["la_segunda", "iarcania", "ayuda_familiar", "otro"];

// Registra un ingreso y lo reparte automáticamente entre las categorías de
// presupuesto activas, en orden de prioridad, hasta agotar el monto. Todo en
// una transacción — es plata.
export async function registerIncome(formData: FormData) {
  const userId = await requireUserId();
  const amount = Number(formData.get("amount"));
  const source = String(formData.get("source") || "otro");
  const description = String(formData.get("description") || "").trim() || null;
  const date = String(formData.get("date") || "") || todayISO();

  if (!amount || amount <= 0) throw new Error("Monto inválido");
  if (!SOURCES.includes(source)) throw new Error("Fuente inválida");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(income)
      .values({ userId, amount, source, description, date, distributionApplied: false })
      .returning();

    const cats = await tx
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.userId, userId), eq(budgetCategories.isActive, true)))
      .orderBy(asc(budgetCategories.priority));

    let remaining = amount;
    for (const cat of cats) {
      if (remaining <= 0) break;
      const deficit = cat.monthlyAmount - cat.currentMonthSpent;
      if (deficit <= 0) continue;
      const assign = Math.min(deficit, remaining);
      await tx.insert(budgetCategoryDistributions).values({
        incomeId: row.id,
        categoryId: cat.id,
        amountAssigned: assign,
      });
      await tx
        .update(budgetCategories)
        .set({ currentMonthSpent: cat.currentMonthSpent + assign })
        .where(eq(budgetCategories.id, cat.id));
      remaining -= assign;
    }

    await tx.update(income).set({ distributionApplied: true }).where(eq(income.id, row.id));
  });

  revalidatePath("/dashboard/dinero/presupuesto");
}

// Ajuste manual del gasto corrido del mes de una categoría.
export async function updateCategorySpent(formData: FormData) {
  const userId = await requireUserId();
  const categoryId = String(formData.get("categoryId") || "");
  const newAmount = Number(formData.get("newAmount"));

  if (!categoryId) throw new Error("Falta la categoría");
  if (Number.isNaN(newAmount) || newAmount < 0) throw new Error("Monto inválido");

  await db
    .update(budgetCategories)
    .set({ currentMonthSpent: newAmount })
    .where(and(eq(budgetCategories.id, categoryId), eq(budgetCategories.userId, userId)));

  revalidatePath("/dashboard/dinero/presupuesto");
}
