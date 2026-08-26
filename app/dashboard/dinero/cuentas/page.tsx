import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema/dinero";
import { Field } from "@/components/ui/field";
import { createAccount, recordMovement } from "../actions";
import { todayISO } from "@/lib/date/bogota";

export default async function CuentasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();

  const userAccounts = await db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
    .orderBy(asc(financialAccounts.sortOrder), asc(financialAccounts.name));

  return (
    <div className="space-y-6">
      {userAccounts.length === 0 ? (
        <p className="text-sm text-text-muted">
          Todavía no tienes cuentas. Agrega la primera abajo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userAccounts.map((account) => (
            <div
              key={account.id}
              className="rounded-md border border-border bg-bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{account.icon || "💰"}</span>
                <span className="font-medium text-text-primary">
                  {account.name}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                ${account.balance.toLocaleString("es-CO")}
              </div>

              <form
                action={recordMovement}
                className="mt-4 space-y-2 border-t border-border pt-3"
              >
                <input type="hidden" name="accountId" value={account.id} />
                <input type="hidden" name="date" value={date} />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    placeholder="Monto"
                    required
                    className="input flex-1"
                  />
                </div>
                <input
                  type="text"
                  name="description"
                  placeholder="Descripción"
                  className="input w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="kind"
                    value="ingreso"
                    className="flex-1 rounded-sm border border-green-500/40 bg-green-500/10 px-2 py-1.5 text-xs font-semibold text-green-400"
                  >
                    + Ingreso
                  </button>
                  <button
                    type="submit"
                    name="kind"
                    value="gasto"
                    className="flex-1 rounded-sm border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-400"
                  >
                    − Gasto
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}

      <form
        action={createAccount}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Nombre">
          <input type="text" name="name" required className="input" />
        </Field>
        <Field label="Ícono (emoji)">
          <input type="text" name="icon" maxLength={2} className="input w-16" />
        </Field>
        <Field label="Saldo inicial">
          <input type="number" step="0.01" name="balance" className="input" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nueva cuenta
        </button>
      </form>
    </div>
  );
}
