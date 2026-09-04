import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts, expenses, income } from "@/lib/db/schema/dinero";
import {
  MetricCard,
  Section,
  Table,
  TableHead,
  TableRow,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Select,
  Button,
} from "@/components/ui";
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
const COLS = "88px 72px 120px minmax(0,1fr) 110px 80px";

export default async function GastosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = monthRange();

  const [monthExpenses, monthIncome, userAccounts] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.date, from), lte(expenses.date, to)))
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db
      .select()
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.date, from), lte(income.date, to)))
      .orderBy(desc(income.date), desc(income.createdAt)),
    db
      .select({ id: financialAccounts.id, name: financialAccounts.name })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
      .orderBy(asc(financialAccounts.name)),
  ]);

  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = monthIncome.reduce((s, i) => s + i.amount, 0);

  type Row =
    | { id: string; kind: "gasto"; date: string; label: string; description: string | null; amount: number }
    | { id: string; kind: "ingreso"; date: string; label: string; description: string | null; amount: number };
  const rows: Row[] = [
    ...monthExpenses.map((e) => ({ id: e.id, kind: "gasto" as const, date: e.date, label: e.category, description: e.description, amount: e.amount })),
    ...monthIncome.map((i) => ({ id: i.id, kind: "ingreso" as const, date: i.date, label: i.source, description: i.description, amount: i.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <MetricCard value={`$${totalExpenses.toLocaleString("es-CO")}`} label="Gastos del mes" tone="danger" />
        <MetricCard value={`$${totalIncome.toLocaleString("es-CO")}`} label="Ingresos del mes" tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form action={recordMovement} className="flex flex-col gap-2 rounded-ui-lg border border-line bg-surface p-4">
          <input type="hidden" name="kind" value="gasto" />
          <input type="hidden" name="date" value={date} />
          <h2 className="text-sm font-semibold text-ink">+ Nuevo gasto</h2>
          <div className="flex flex-wrap gap-2">
            <Labeled label="Monto">
              <Input type="number" step="0.01" name="amount" required className="w-32" />
            </Labeled>
            <Labeled label="Categoría">
              <Select name="category">
                {GASTO_CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Labeled>
          </div>
          <Input name="description" placeholder="Descripción" className="w-full" />
          <Labeled label="Cuenta (opcional)">
            <Select name="accountId" className="w-full">
              <option value="">Sin cuenta</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Button type="submit" className="w-full">
            Registrar gasto
          </Button>
        </form>

        <form action={recordMovement} className="flex flex-col gap-2 rounded-ui-lg border border-line bg-surface p-4">
          <input type="hidden" name="kind" value="ingreso" />
          <input type="hidden" name="date" value={date} />
          <h2 className="text-sm font-semibold text-ink">+ Nuevo ingreso</h2>
          <div className="flex flex-wrap gap-2">
            <Labeled label="Monto">
              <Input type="number" step="0.01" name="amount" required className="w-32" />
            </Labeled>
            <Labeled label="Fuente">
              <Input name="source" placeholder="salario, freelance…" className="w-40" />
            </Labeled>
          </div>
          <Input name="description" placeholder="Descripción" className="w-full" />
          <Labeled label="Cuenta (opcional)">
            <Select name="accountId" className="w-full">
              <option value="">Sin cuenta</option>
              {userAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Button type="submit" className="w-full">
            Registrar ingreso
          </Button>
        </form>
      </div>

      <Section title="Movimientos del mes">
        {rows.length === 0 ? (
          <EmptyState icon="💸">
            El registro de gastos e ingresos del mes. Todavía no has movido nada — usa los
            formularios de arriba.
          </EmptyState>
        ) : (
          <Table>
            <TableHead cols={COLS}>
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Categoría / Fuente</span>
              <span>Descripción</span>
              <span className="text-right">Monto</span>
              <span className="text-right">Acción</span>
            </TableHead>
            {rows.map((r) => (
              <TableRow key={`${r.kind}-${r.id}`} cols={COLS}>
                <span className="text-meta tabular-nums text-ink-dim">{r.date.slice(5)}</span>
                <span>
                  <Badge tone={r.kind === "gasto" ? "danger" : "success"}>
                    {r.kind === "gasto" ? "Gasto" : "Ingreso"}
                  </Badge>
                </span>
                <span className="text-meta text-ink-muted">{r.label}</span>
                <span className="truncate text-ink" title={r.description ?? undefined}>
                  {r.description ?? "—"}
                </span>
                <span
                  className={`text-right tabular-nums ${r.kind === "gasto" ? "text-danger" : "text-success"}`}
                >
                  {r.kind === "gasto" ? "−" : "+"}${r.amount.toLocaleString("es-CO")}
                </span>
                <span className="flex justify-end text-meta text-ink-dim">
                  <form action={r.kind === "gasto" ? deleteExpense : deleteIncome}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="hover:text-danger">
                      Eliminar
                    </button>
                  </form>
                </span>
              </TableRow>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
