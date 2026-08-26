import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bills, billPayments } from "@/lib/db/schema/facturas";
import { financialAccounts } from "@/lib/db/schema/dinero";
import { Field } from "@/components/ui/field";
import { createBill, payBill } from "./actions";
import { todayISO, currentMonthRangeISO as monthRange } from "@/lib/date/bogota";

export default async function FacturasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = monthRange();

  const [userBills, monthPayments, recentPayments, userAccounts] =
    await Promise.all([
      db
        .select()
        .from(bills)
        .where(and(eq(bills.userId, userId), eq(bills.isActive, true)))
        .orderBy(asc(bills.dueDay), asc(bills.name)),
      db
        .select({ billId: billPayments.billId })
        .from(billPayments)
        .where(
          and(
            eq(billPayments.userId, userId),
            eq(billPayments.type, "normal"),
            gte(billPayments.paidDate, from),
            lte(billPayments.paidDate, to),
          ),
        ),
      db
        .select()
        .from(billPayments)
        .where(eq(billPayments.userId, userId))
        .orderBy(desc(billPayments.paidDate), desc(billPayments.createdAt))
        .limit(50),
      db
        .select({ id: financialAccounts.id, name: financialAccounts.name })
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.userId, userId),
            eq(financialAccounts.isActive, true),
          ),
        )
        .orderBy(asc(financialAccounts.name)),
    ]);

  const paidThisMonth = new Set(monthPayments.map((p) => p.billId));
  const paymentsByBill = new Map<string, typeof recentPayments>();
  for (const payment of recentPayments) {
    const list = paymentsByBill.get(payment.billId) ?? [];
    if (list.length < 3) list.push(payment);
    paymentsByBill.set(payment.billId, list);
  }

  return (
    <div className="space-y-6">
      {userBills.length === 0 ? (
        <p className="text-sm text-text-muted">
          Todavía no tienes facturas. Agrega la primera abajo.
        </p>
      ) : (
        <div className="space-y-4">
          {userBills.map((bill) => {
            const isPaid = paidThisMonth.has(bill.id);
            const history = paymentsByBill.get(bill.id) ?? [];
            return (
              <div
                key={bill.id}
                className="rounded-md border border-border bg-bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-primary">
                    {bill.name}
                  </span>
                  <span className="text-xs text-text-muted">
                    día {bill.dueDay} · {bill.category ?? "sin categoría"} ·
                    est. ${bill.estimatedAmount.toLocaleString("es-CO")}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isPaid
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {isPaid ? "Pagada este mes" : "Pendiente este mes"}
                  </span>
                </div>

                {history.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-text-muted">
                    {history.map((p) => (
                      <li key={p.id}>
                        {p.paidDate} · $
                        {p.amount.toLocaleString("es-CO")}
                        {p.type === "cargo_extra" ? " · cargo extra" : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  action={payBill}
                  className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3"
                >
                  <input type="hidden" name="billId" value={bill.id} />
                  <Field label="Monto">
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      defaultValue={bill.estimatedAmount}
                      required
                      className="input"
                    />
                  </Field>
                  <Field label="Fecha">
                    <input
                      type="date"
                      name="paidDate"
                      defaultValue={date}
                      required
                      className="input"
                    />
                  </Field>
                  <Field label="Cuenta (opcional)">
                    <select name="accountId" className="input">
                      <option value="">Sin cuenta</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nota">
                    <input type="text" name="notesExtra" className="input" />
                  </Field>
                  <button
                    type="submit"
                    name="type"
                    value="normal"
                    className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
                  >
                    Pagar
                  </button>
                  <button
                    type="submit"
                    name="type"
                    value="cargo_extra"
                    className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
                  >
                    + Cargo extra
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form
        action={createBill}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Nombre">
          <input type="text" name="name" required className="input" />
        </Field>
        <Field label="Monto estimado">
          <input
            type="number"
            step="0.01"
            name="estimatedAmount"
            required
            className="input"
          />
        </Field>
        <Field label="Día de vencimiento (1-28)">
          <input
            type="number"
            name="dueDay"
            min={1}
            max={28}
            required
            className="input"
          />
        </Field>
        <Field label="Categoría">
          <input type="text" name="category" className="input" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nueva factura
        </button>
      </form>
    </div>
  );
}
