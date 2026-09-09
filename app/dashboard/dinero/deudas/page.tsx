import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { personalDebts } from "@/lib/db/schema/dinero";
import {
  Section,
  MetricCard,
  Progress,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Button,
  cx,
} from "@/components/ui";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { createDebt, makePayment, deleteDebt } from "./actions";

const cop = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default async function DeudasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();
  const soon = addDaysISO(today, 7);

  const debts = await db
    .select()
    .from(personalDebts)
    .where(eq(personalDebts.userId, userId))
    .orderBy(sql`${personalDebts.dueDate} asc nulls last`, desc(personalDebts.totalAmount));

  const totalActiva = debts
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + d.remainingAmount, 0);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Resumen">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <MetricCard value={cop(totalActiva)} label="Total deuda activa" tone="danger" />
        </div>
      </Section>

      <Section title="Deudas">
        {debts.length === 0 ? (
          <EmptyState icon="💸">
            Lo que debes, con su progreso. Todavía no has registrado ninguna deuda — agrega la
            primera abajo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {debts.map((d) => {
              const paid = d.totalAmount - d.remainingAmount;
              const pct = d.totalAmount > 0 ? (paid / d.totalAmount) * 100 : 0;
              const overdueSoon = d.dueDate != null && d.dueDate <= soon;
              const months =
                d.monthlyPayment && d.monthlyPayment > 0
                  ? Math.ceil(d.remainingAmount / d.monthlyPayment)
                  : null;
              return (
                <div
                  key={d.id}
                  className={cx(
                    "flex flex-col gap-2.5 rounded-ui-lg border border-line bg-surface p-4",
                    d.status === "paid" && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {d.creditor}
                    </span>
                    <Badge tone={d.status === "paid" ? "success" : "warm"}>
                      {d.status === "paid" ? "pagada" : "activa"}
                    </Badge>
                  </div>

                  <Progress pct={pct} tone="success" value={`${Math.round(pct)}%`} />

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta tabular-nums">
                    <span className="text-danger">{cop(d.remainingAmount)} restante</span>
                    <span className="text-success">{cop(paid)} pagado</span>
                    {d.monthlyPayment != null && (
                      <span className="text-ink-dim">Cuota {cop(d.monthlyPayment)}/mes</span>
                    )}
                    {d.dueDate != null && (
                      <span className={overdueSoon ? "text-danger" : "text-ink-dim"}>
                        Vence {d.dueDate}
                      </span>
                    )}
                    {months != null && (
                      <span className="text-ink-dim">
                        Se liquida en {months} {months === 1 ? "mes" : "meses"}
                      </span>
                    )}
                  </div>

                  {d.notes && <p className="text-meta text-ink-dim">{d.notes}</p>}

                  <div className="flex flex-wrap items-end gap-2 border-t border-line pt-2.5">
                    <form action={makePayment} className="flex items-end gap-1.5">
                      <input type="hidden" name="debtId" value={d.id} />
                      <Labeled label="Abono">
                        <Input type="number" step="0.01" name="amount" required className="w-32" />
                      </Labeled>
                      <Button type="submit" variant="secondary" size="sm">
                        Abonar
                      </Button>
                    </form>
                    <form action={deleteDebt}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="pb-1.5 text-meta text-ink-dim hover:text-danger"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <form
        action={createDebt}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Acreedor">
          <Input name="creditor" required className="w-44" />
        </Labeled>
        <Labeled label="Monto total">
          <Input type="number" step="0.01" name="totalAmount" required className="w-36" />
        </Labeled>
        <Labeled label="Cuota mensual (opcional)">
          <Input type="number" step="0.01" name="monthlyPayment" className="w-36" />
        </Labeled>
        <Labeled label="Fecha límite (opcional)">
          <Input type="date" name="dueDate" className="w-40" />
        </Labeled>
        <Labeled label="Notas (opcional)">
          <Input name="notes" className="w-56" />
        </Labeled>
        <Button type="submit" variant="secondary">
          + Nueva deuda
        </Button>
      </form>
    </div>
  );
}
