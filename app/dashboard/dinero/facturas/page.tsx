import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bills, billPayments } from "@/lib/db/schema/facturas";
import { financialAccounts } from "@/lib/db/schema/dinero";
import { Badge, EmptyState, Labeled, Input, Select, Button } from "@/components/ui";
import { createBill, payBill } from "./actions";
import { todayISO, currentMonthRangeISO as monthRange } from "@/lib/date/bogota";

export default async function FacturasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = monthRange();

  const [userBills, monthPayments, recentPayments, userAccounts] = await Promise.all([
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
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
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
    <div className="flex flex-col gap-6">
      {userBills.length === 0 ? (
        <EmptyState icon="🧾">
          Tus facturas recurrentes: arriendo, servicios, suscripciones. Todavía no has registrado
          ninguna — agrega la primera abajo y luego marca cada pago del mes.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {userBills.map((bill) => {
            const isPaid = paidThisMonth.has(bill.id);
            const history = paymentsByBill.get(bill.id) ?? [];
            return (
              <div key={bill.id} className="rounded-ui-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{bill.name}</span>
                  <span className="text-meta text-ink-dim">
                    día {bill.dueDay} · {bill.category ?? "sin categoría"} · est. $
                    {bill.estimatedAmount.toLocaleString("es-CO")}
                  </span>
                  <span className="ml-auto">
                    <Badge tone={isPaid ? "success" : "danger"}>
                      {isPaid ? "Pagada este mes" : "Pendiente este mes"}
                    </Badge>
                  </span>
                </div>

                {history.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5 text-meta text-ink-dim">
                    {history.map((p) => (
                      <li key={p.id} className="tabular-nums">
                        {p.paidDate} · ${p.amount.toLocaleString("es-CO")}
                        {p.type === "cargo_extra" ? " · cargo extra" : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <form action={payBill} className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                  <input type="hidden" name="billId" value={bill.id} />
                  <Labeled label="Monto">
                    <Input
                      type="number"
                      step="0.01"
                      name="amount"
                      defaultValue={bill.estimatedAmount}
                      required
                      className="w-32"
                    />
                  </Labeled>
                  <Labeled label="Fecha">
                    <Input type="date" name="paidDate" defaultValue={date} required className="w-40" />
                  </Labeled>
                  <Labeled label="Cuenta (opcional)">
                    <Select name="accountId">
                      <option value="">Sin cuenta</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Labeled>
                  <Labeled label="Nota">
                    <Input name="notesExtra" className="w-40" />
                  </Labeled>
                  <Button type="submit" name="type" value="normal">
                    Pagar
                  </Button>
                  <Button type="submit" name="type" value="cargo_extra" variant="secondary">
                    + Cargo extra
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form
        action={createBill}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Nombre">
          <Input name="name" required className="w-48" />
        </Labeled>
        <Labeled label="Monto estimado">
          <Input type="number" step="0.01" name="estimatedAmount" required className="w-32" />
        </Labeled>
        <Labeled label="Día de vencimiento (1-28)">
          <Input type="number" name="dueDay" min={1} max={28} required className="w-24" />
        </Labeled>
        <Labeled label="Categoría">
          <Input name="category" className="w-36" />
        </Labeled>
        <Button type="submit" variant="secondary">
          + Nueva factura
        </Button>
      </form>
    </div>
  );
}
