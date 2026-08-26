import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts, expenses, income } from "@/lib/db/schema/dinero";
import { Field } from "@/components/ui/field";
import { recordMovement, deleteExpense, deleteIncome } from "../actions";
import { todayISO, currentMonthRangeISO as monthRange } from "@/lib/date/bogota";

const GASTO_CATS = [
  "mercado",
  "restaurantes",
  "transporte",
  "servicios",
  "salud",
  "tecnologia",
  "hogar",
  "otros",
];

export default async function GastosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = monthRange();

  const [monthExpenses, monthIncome, userAccounts] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, from),
          lte(expenses.date, to),
        ),
      )
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db
      .select()
      .from(income)
      .where(
        and(
          eq(income.userId, userId),
          gte(income.date, from),
          lte(income.date, to),
        ),
      )
      .orderBy(desc(income.date), desc(income.createdAt)),
    db
      .select({ id: financialAccounts.id, name: financialAccounts.name })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
      .orderBy(asc(financialAccounts.name)),
  ]);

  const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = monthIncome.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1 rounded-md border border-border bg-bg-card px-4 py-3">
          <div className="text-lg font-bold text-red-400">
            ${totalExpenses.toLocaleString("es-CO")}
          </div>
          <div className="text-xs text-text-muted">Gastos del mes</div>
        </div>
        <div className="min-w-[160px] flex-1 rounded-md border border-border bg-bg-card px-4 py-3">
          <div className="text-lg font-bold text-green-400">
            ${totalIncome.toLocaleString("es-CO")}
          </div>
          <div className="text-xs text-text-muted">Ingresos del mes</div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <form
          action={recordMovement}
          className="space-y-2 rounded-md border border-border bg-bg-card p-4"
        >
          <input type="hidden" name="kind" value="gasto" />
          <input type="hidden" name="date" value={date} />
          <h2 className="text-sm font-semibold text-text-primary">
            + Nuevo gasto
          </h2>
          <div className="flex gap-2">
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                name="amount"
                required
                className="input"
              />
            </Field>
            <Field label="Categoría">
              <select name="category" className="input">
                {GASTO_CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <input
            type="text"
            name="description"
            placeholder="Descripción"
            className="input w-full"
          />
          <Field label="Cuenta (opcional)">
            <select name="accountId" className="input w-full">
              <option value="">Sin cuenta</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            className="w-full rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Registrar gasto
          </button>
        </form>

        <form
          action={recordMovement}
          className="space-y-2 rounded-md border border-border bg-bg-card p-4"
        >
          <input type="hidden" name="kind" value="ingreso" />
          <input type="hidden" name="date" value={date} />
          <h2 className="text-sm font-semibold text-text-primary">
            + Nuevo ingreso
          </h2>
          <div className="flex gap-2">
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                name="amount"
                required
                className="input"
              />
            </Field>
            <Field label="Fuente">
              <input type="text" name="source" placeholder="salario, freelance…" className="input" />
            </Field>
          </div>
          <input
            type="text"
            name="description"
            placeholder="Descripción"
            className="input w-full"
          />
          <Field label="Cuenta (opcional)">
            <select name="accountId" className="input w-full">
              <option value="">Sin cuenta</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            className="w-full rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Registrar ingreso
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Movimientos del mes
        </h2>
        {monthExpenses.length === 0 && monthIncome.length === 0 ? (
          <p className="text-sm text-text-muted">
            Sin movimientos este mes todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Categoría / Fuente</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Monto</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {monthExpenses.map((e) => (
                  <tr key={`exp-${e.id}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-muted">{e.date}</td>
                    <td className="px-3 py-2 text-red-400">Gasto</td>
                    <td className="px-3 py-2 text-text-muted">{e.category}</td>
                    <td className="px-3 py-2 text-text-primary">
                      {e.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-red-400">
                      -${e.amount.toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2">
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className="text-xs text-text-muted hover:text-red-400"
                        >
                          Eliminar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {monthIncome.map((i) => (
                  <tr key={`inc-${i.id}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-muted">{i.date}</td>
                    <td className="px-3 py-2 text-green-400">Ingreso</td>
                    <td className="px-3 py-2 text-text-muted">{i.source}</td>
                    <td className="px-3 py-2 text-text-primary">
                      {i.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-green-400">
                      +${i.amount.toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2">
                      <form action={deleteIncome}>
                        <input type="hidden" name="id" value={i.id} />
                        <button
                          type="submit"
                          className="text-xs text-text-muted hover:text-red-400"
                        >
                          Eliminar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
