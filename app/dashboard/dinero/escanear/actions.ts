"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { expenses, financialAccounts } from "@/lib/db/schema/dinero";
import { bills, billPayments } from "@/lib/db/schema/facturas";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

// A diferencia del original (que al escanear una factura_recurrente creaba
// la fila en `bills` pero NUNCA un `bill_payments`, así que quedaba
// "pendiente este mes" pese a acabar de registrarse), aquí sí se registra el
// pago junto con la factura — el recibo escaneado ES la evidencia del pago.
export async function registerScan(formData: FormData) {
  const userId = await requireUserId();
  const tipo = String(formData.get("tipo") || "gasto_puntual");
  const descripcion = String(formData.get("descripcion") || "").trim() || null;
  const monto = Number(formData.get("monto"));
  const fecha = String(formData.get("fecha") || "");
  const categoria = String(formData.get("categoria") || "otros");
  const accountId = String(formData.get("accountId") || "") || null;

  if (!monto || monto <= 0) throw new Error("Monto inválido");
  if (!fecha) throw new Error("Fecha inválida");

  await db.transaction(async (tx) => {
    if (accountId) {
      const [account] = await tx
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(eq(financialAccounts.id, accountId))
        .limit(1);
      if (!account) throw new Error("Cuenta no encontrada");
    }

    let expenseDescription = descripcion;

    if (tipo === "factura_recurrente") {
      // Día del mes extraído directo del string "YYYY-MM-DD" — new
      // Date(fecha).getDate() está mal: una fecha ISO sin hora se parsea
      // como medianoche UTC y .getDate() la lee en la timezone del
      // servidor, lo que puede correr el día (bug real, no solo en Docker).
      const dueDay = Number(formData.get("dueDay")) || Number(fecha.slice(8, 10));
      const [bill] = await tx
        .insert(bills)
        .values({
          userId,
          name: descripcion || "Factura escaneada",
          estimatedAmount: monto,
          dueDay: Math.min(28, Math.max(1, dueDay)),
          category: categoria,
        })
        .returning();

      await tx.insert(billPayments).values({
        billId: bill.id,
        userId,
        amount: monto,
        paidDate: fecha,
        type: "normal",
        accountId,
        notes: "Registrado por escaneo",
      });

      expenseDescription = `Factura: ${bill.name}`;
    }

    await tx.insert(expenses).values({
      userId,
      amount: monto,
      category: categoria,
      description: expenseDescription,
      date: fecha,
      accountId,
      notes: "Registrado por escaneo",
    });

    if (accountId) {
      await tx
        .update(financialAccounts)
        .set({ balance: sql`${financialAccounts.balance} - ${monto}` })
        .where(eq(financialAccounts.id, accountId));
    }
  });

  revalidatePath("/dashboard/dinero/gastos");
  revalidatePath("/dashboard/dinero/facturas");
  revalidatePath("/dashboard/dinero/cuentas");
}
