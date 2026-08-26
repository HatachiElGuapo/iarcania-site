"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets, budgetDistributions, debts } from "@/lib/db/schema/crm";
import { income } from "@/lib/db/schema/dinero";
import { projects } from "@/lib/db/schema/clientes";
import { todayISO } from "@/lib/date/bogota";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

function currentMonthYear() {
  const [year, month] = todayISO().split("-").map(Number);
  return { month, year };
}

// Reparte un ingreso ya insertado entre los presupuestos activos del mes con
// déficit, en orden de prioridad — mismo algoritmo que _crmPreviewDistribution
// + crmConfirmarIngreso del original, sin el paso intermedio de preview (el
// original mostraba una vista previa antes de confirmar; aquí se aplica
// directo y el resultado se ve en la tabla de Presupuesto tras guardar —
// simplificación consciente, ver NOTES.md).
async function applyDistribution(userId: string, incomeId: string, amount: number) {
  const { month, year } = currentMonthYear();
  const activeBudgets = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month), eq(budgets.year, year), eq(budgets.isActive, true)))
    .orderBy(budgets.priority);

  if (activeBudgets.length === 0) return;

  const ids = activeBudgets.map((b) => b.id);
  const dists = await db
    .select()
    .from(budgetDistributions)
    .where(inArray(budgetDistributions.budgetId, ids));

  let remaining = amount;
  const rows: { budgetId: string; incomeId: string; amountAssigned: number }[] = [];
  for (const b of activeBudgets) {
    if (remaining <= 0) break;
    const already = dists
      .filter((d) => d.budgetId === b.id)
      .reduce((s, d) => s + d.amountAssigned, 0);
    const gap = Math.max(0, b.amount - already);
    const assign = Math.min(remaining, gap);
    if (assign > 0) rows.push({ budgetId: b.id, incomeId, amountAssigned: assign });
    remaining -= assign;
  }

  if (rows.length > 0) {
    await db.insert(budgetDistributions).values(rows);
    await db.update(income).set({ distributionApplied: true }).where(eq(income.id, incomeId));
  }
}

// ─── Presupuesto ───────────────────────────────────────────

export async function createBudget(formData: FormData) {
  const userId = await requireUserId();
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount"));
  const priority = Number(formData.get("priority")) || 1;

  if (!category) throw new Error("La categoría es obligatoria");
  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const { month, year } = currentMonthYear();
  await db.insert(budgets).values({ userId, category, amount, priority, month, year });

  revalidatePath("/dashboard/crm");
}

// No hay "eliminar presupuesto" — desactivar en vez de borrar conserva el
// historial de budget_distributions ya repartido contra esta categoría.
export async function deactivateBudget(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db
    .update(budgets)
    .set({ isActive: false })
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));

  revalidatePath("/dashboard/crm");
}

export async function registrarIngreso(formData: FormData) {
  const userId = await requireUserId();
  const amount = Number(formData.get("amount"));
  const source = String(formData.get("source") || "otro");
  const description = String(formData.get("description") || "").trim() || null;
  const distribuir = formData.get("distribuir") === "1";

  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const [row] = await db
    .insert(income)
    .values({ userId, amount, source, description, date: todayISO() })
    .returning({ id: income.id });

  if (distribuir) await applyDistribution(userId, row.id, amount);

  revalidatePath("/dashboard/crm");
}

// ─── Pipeline ──────────────────────────────────────────────

export async function createDeal(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "") || null;
  const serviceType = String(formData.get("serviceType") || "") || null;
  const value = formData.get("value") ? Number(formData.get("value")) : null;
  const stage = String(formData.get("stage") || "contacted");

  if (!name) throw new Error("El nombre del deal es obligatorio");

  await db.insert(projects).values({ userId, clientId, name, serviceType, value, stage });

  revalidatePath("/dashboard/crm");
}

export async function moveDealStage(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const stage = String(formData.get("stage") || "");

  await db
    .update(projects)
    .set(stage === "lost" ? { stage, closedAt: new Date() } : { stage })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  revalidatePath("/dashboard/crm");
}

export async function registerDealPayment(formData: FormData) {
  const userId = await requireUserId();
  const dealId = String(formData.get("dealId") || "");
  const amount = Number(formData.get("amount"));
  const source = String(formData.get("source") || "otro");
  const description = String(formData.get("description") || "").trim() || null;
  const distribuir = formData.get("distribuir") === "1";
  const markWon = formData.get("markWon") === "1";

  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const [deal] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, dealId), eq(projects.userId, userId)))
    .limit(1);
  if (!deal) throw new Error("Deal no encontrado");

  const [row] = await db
    .insert(income)
    .values({
      userId,
      amount,
      source,
      description,
      date: todayISO(),
      clientId: deal.clientId,
      projectId: deal.id,
    })
    .returning({ id: income.id });

  if (distribuir) await applyDistribution(userId, row.id, amount);

  if (markWon) {
    const anticipoPct = deal.value ? Math.round((amount / deal.value) * 100) : deal.anticipoPct;
    await db
      .update(projects)
      .set({ stage: "won", anticipoPaid: true, anticipoPct, closedAt: new Date() })
      .where(and(eq(projects.id, dealId), eq(projects.userId, userId)));
  }

  revalidatePath("/dashboard/crm");
}

// ─── Deudas ────────────────────────────────────────────────

export async function createDebt(formData: FormData) {
  const userId = await requireUserId();
  const creditor = String(formData.get("creditor") || "").trim();
  const debtor = String(formData.get("debtor") || "").trim();
  const totalAmount = Number(formData.get("totalAmount"));
  const monthlyPayment = formData.get("monthlyPayment")
    ? Number(formData.get("monthlyPayment"))
    : null;
  const dueDate = String(formData.get("dueDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!creditor || !debtor) throw new Error("Acreedor y deudor son obligatorios");
  if (!totalAmount || totalAmount <= 0) throw new Error("Monto inválido");

  await db.insert(debts).values({
    userId,
    creditor,
    debtor,
    totalAmount,
    remainingAmount: totalAmount,
    monthlyPayment,
    dueDate,
    notes,
  });

  revalidatePath("/dashboard/crm");
}

export async function registerDebtPayment(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) throw new Error("Monto inválido");

  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, userId)))
    .limit(1);
  if (!debt) throw new Error("Deuda no encontrada");

  const remainingAmount = Math.max(0, debt.remainingAmount - amount);
  await db
    .update(debts)
    .set({ remainingAmount, status: remainingAmount <= 0 ? "paid" : "active" })
    .where(and(eq(debts.id, id), eq(debts.userId, userId)));

  revalidatePath("/dashboard/crm");
}

export async function deleteDebt(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));

  revalidatePath("/dashboard/crm");
}
