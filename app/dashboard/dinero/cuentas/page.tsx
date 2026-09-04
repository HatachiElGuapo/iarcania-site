import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema/dinero";
import { EmptyState, Labeled, Input, Button } from "@/components/ui";
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

  const total = userAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="flex flex-col gap-6">
      {userAccounts.length === 0 ? (
        <EmptyState icon="💰">
          Tus cuentas y saldos: bolsillo, banco, billeteras. Todavía no has creado ninguna — agrega
          la primera abajo.
        </EmptyState>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-ink">
              ${total.toLocaleString("es-CO")}
            </span>
            <span className="text-meta text-ink-dim">
              en {userAccounts.length} cuenta{userAccounts.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userAccounts.map((account) => (
              <div key={account.id} className="rounded-ui-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{account.icon || "💰"}</span>
                  <span className="font-medium text-ink">{account.name}</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">
                  ${account.balance.toLocaleString("es-CO")}
                </div>

                <form action={recordMovement} className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="hidden" name="date" value={date} />
                  <Input type="number" step="0.01" name="amount" placeholder="Monto" required className="w-full" />
                  <Input name="description" placeholder="Descripción" className="w-full" />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      name="kind"
                      value="ingreso"
                      className="focus-ring flex-1 rounded-ui border border-success/40 bg-success/10 px-2 py-1.5 text-meta font-semibold text-success transition-colors duration-120 hover:border-success"
                    >
                      + Ingreso
                    </button>
                    <button
                      type="submit"
                      name="kind"
                      value="gasto"
                      className="focus-ring flex-1 rounded-ui border border-danger/40 bg-danger/10 px-2 py-1.5 text-meta font-semibold text-danger transition-colors duration-120 hover:border-danger"
                    >
                      − Gasto
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      <form
        action={createAccount}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Nombre">
          <Input name="name" required className="w-48" />
        </Labeled>
        <Labeled label="Ícono (emoji)">
          <Input name="icon" maxLength={2} className="w-16" />
        </Labeled>
        <Labeled label="Saldo inicial">
          <Input type="number" step="0.01" name="balance" className="w-32" />
        </Labeled>
        <Button type="submit" variant="secondary">
          + Nueva cuenta
        </Button>
      </form>
    </div>
  );
}
