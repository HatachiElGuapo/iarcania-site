import { and, asc, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { income, expenses, budgetCategories } from "@/lib/db/schema/dinero";
import {
  Section,
  MetricCard,
  Progress,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { todayISO, currentMonthRangeISO } from "@/lib/date/bogota";
import { registerIncome, updateCategorySpent } from "./actions";

const cop = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

type SemTone = "success" | "warm" | "danger";
function semaforo(spent: number, assigned: number): { tone: SemTone; label: string } {
  if (assigned > 0 && spent === 0) return { tone: "danger", label: "Sin cubrir" };
  if (assigned <= 0) return { tone: "success", label: "Sin meta" };
  const pct = spent / assigned;
  if (pct >= 1) return { tone: "danger", label: "Pasado" };
  if (pct >= 0.8) return { tone: "warm", label: "Al límite" };
  return { tone: "success", label: "En verde" };
}

export default async function PresupuestoPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from } = currentMonthRangeISO();

  const [monthIncome, monthExpenses, cats] = await Promise.all([
    db.select().from(income).where(and(eq(income.userId, userId), gte(income.date, from))),
    db.select().from(expenses).where(and(eq(expenses.userId, userId), gte(expenses.date, from))),
    db
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.userId, userId), eq(budgetCategories.isActive, true)))
      .orderBy(asc(budgetCategories.priority)),
  ]);

  const ingresoMes = monthIncome.reduce((s, i) => s + i.amount, 0);
  const gastoMes = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = ingresoMes - gastoMes;

  return (
    <div className="flex flex-col gap-8">
      <Section title="Resumen del mes">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <MetricCard value={cop(ingresoMes)} label="Ingreso del mes" tone="primary" />
          <MetricCard value={cop(gastoMes)} label="Gasto del mes" tone="primary" />
          <MetricCard
            value={(balance < 0 ? "−" : "") + cop(Math.abs(balance))}
            label="Balance"
            tone={balance >= 0 ? "success" : "danger"}
          />
        </div>
      </Section>

      <Section title="Semáforo de categorías">
        {cats.length === 0 ? (
          <EmptyState icon="💰">
            El reparto de tus ingresos por prioridad. Todavía no has definido categorías de
            presupuesto.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-1.5">
            {cats.map((cat) => {
              const s = semaforo(cat.currentMonthSpent, cat.monthlyAmount);
              const pct = cat.monthlyAmount > 0 ? (cat.currentMonthSpent / cat.monthlyAmount) * 100 : 0;
              return (
                <div
                  key={cat.id}
                  className="flex flex-col gap-2 rounded-ui border border-line bg-surface px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-body text-ink">{cat.name}</span>
                    <span className="text-meta tabular-nums text-ink-dim">
                      {cop(cat.monthlyAmount)}/mes
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>

                  <Progress
                    pct={pct}
                    tone={s.tone}
                    value={`${Math.round(pct)}%`}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-meta tabular-nums text-ink-dim">
                      {cop(cat.currentMonthSpent)} gastado de {cop(cat.monthlyAmount)} asignado
                    </span>
                    <form action={updateCategorySpent} className="flex items-center gap-1.5">
                      <input type="hidden" name="categoryId" value={cat.id} />
                      <Input
                        type="number"
                        step="0.01"
                        name="newAmount"
                        defaultValue={cat.currentMonthSpent}
                        aria-label={`Ajustar gasto de ${cat.name}`}
                        className="w-28"
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Ajustar
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <form
        action={registerIncome}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Monto">
          <Input type="number" step="0.01" name="amount" required className="w-32" />
        </Labeled>
        <Labeled label="Fuente">
          <Select name="source" defaultValue="la_segunda">
            <option value="la_segunda">La Segunda</option>
            <option value="iarcania">IArcanIA</option>
            <option value="ayuda_familiar">Ayuda familiar</option>
            <option value="otro">Otro</option>
          </Select>
        </Labeled>
        <Labeled label="Descripción (opcional)">
          <Input name="description" className="w-56" />
        </Labeled>
        <Labeled label="Fecha">
          <Input type="date" name="date" defaultValue={date} className="w-40" />
        </Labeled>
        <Button type="submit" variant="secondary">
          + Registrar ingreso
        </Button>
      </form>
    </div>
  );
}
