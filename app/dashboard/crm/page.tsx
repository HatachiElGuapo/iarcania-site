import { and, asc, desc, eq, inArray, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets, budgetDistributions, debts } from "@/lib/db/schema/crm";
import { income } from "@/lib/db/schema/dinero";
import { clients, projects } from "@/lib/db/schema/clientes";
import { Field } from "@/components/ui/field";
import { todayISO } from "@/lib/date/bogota";
import {
  createBudget,
  deactivateBudget,
  registrarIngreso,
  createDeal,
  moveDealStage,
  registerDealPayment,
  createDebt,
  registerDebtPayment,
  deleteDebt,
} from "./actions";

type Budget = InferSelectModel<typeof budgets>;
type Deal = InferSelectModel<typeof projects>;
type Debt = InferSelectModel<typeof debts>;
type Client = InferSelectModel<typeof clients>;

const TABS = [
  { id: "presupuesto", label: "💰 Presupuesto" },
  { id: "pipeline", label: "📊 Pipeline" },
  { id: "clientes", label: "👥 Clientes" },
  { id: "deudas", label: "🔴 Deudas" },
];

const STAGE_CFG = [
  { key: "contacted", label: "Contactado", color: "text-text-muted" },
  { key: "demo", label: "Demo", color: "text-purple-light" },
  { key: "proposal", label: "Propuesta", color: "text-gold" },
  { key: "negotiation", label: "Negociación", color: "text-amber-400" },
  { key: "won", label: "Ganado", color: "text-green-400" },
  { key: "lost", label: "Perdido", color: "text-red-400" },
];

const SOURCES = [
  ["iarcania", "IArcanIA"],
  ["la_segunda", "La Segunda"],
  ["family_help", "Ayuda familiar"],
  ["otro", "Otro"],
];

function cop(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "presupuesto";
  const today = todayISO();
  const [year, month] = today.split("-").map(Number);

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">CRM</h1>

      <div className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={t.id === "presupuesto" ? "/dashboard/crm" : `/dashboard/crm?tab=${t.id}`}
            className={`rounded-sm px-3 py-1.5 ${
              tab === t.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === "presupuesto" && (
        <PresupuestoTab userId={userId} month={month} year={year} today={today} />
      )}
      {tab === "pipeline" && <PipelineTab userId={userId} />}
      {tab === "clientes" && <ClientesTab userId={userId} />}
      {tab === "deudas" && <DeudasTab userId={userId} today={today} />}
    </div>
  );
}

async function PresupuestoTab({
  userId,
  month,
  year,
  today,
}: {
  userId: string;
  month: number;
  year: number;
  today: string;
}) {
  const activeBudgets = await db
    .select()
    .from(budgets)
    .where(
      and(eq(budgets.userId, userId), eq(budgets.month, month), eq(budgets.year, year), eq(budgets.isActive, true)),
    )
    .orderBy(asc(budgets.priority));

  const ids = activeBudgets.map((b) => b.id);
  const dists = ids.length
    ? await db.select().from(budgetDistributions).where(inArray(budgetDistributions.budgetId, ids))
    : [];

  const spentFor = (b: Budget) =>
    dists.filter((d) => d.budgetId === b.id).reduce((s, d) => s + d.amountAssigned, 0);

  const totalNeeded = activeBudgets.reduce((s, b) => s + b.amount, 0);
  const totalCovered = activeBudgets.reduce((s, b) => s + spentFor(b), 0);

  const monthIncome = await db
    .select()
    .from(income)
    .where(eq(income.userId, userId))
    .orderBy(desc(income.createdAt));
  const thisMonthIncome = monthIncome.filter((i) => i.date.startsWith(`${year}-${String(month).padStart(2, "0")}`));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="rounded-md border border-gold/30 bg-bg-card p-4">
          {activeBudgets.length === 0 ? (
            <p className="text-sm text-text-muted">Sin categorías de presupuesto este mes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 text-left">#</th>
                  <th className="pb-2 text-left">Categoría</th>
                  <th className="pb-2 text-right">Meta</th>
                  <th className="pb-2 text-right">Asignado</th>
                  <th className="pb-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {activeBudgets.map((b) => {
                  const spent = spentFor(b);
                  const sem =
                    spent >= b.amount
                      ? { label: "● Cubierto", cls: "text-green-400" }
                      : spent > 0
                        ? { label: "● Parcial", cls: "text-gold" }
                        : { label: "● Sin cubrir", cls: "text-red-400" };
                  return (
                    <tr key={b.id} className="border-b border-border/50">
                      <td className="py-2 text-text-muted">{b.priority}</td>
                      <td className="py-2 text-text-primary">{b.category}</td>
                      <td className="py-2 text-right text-text-muted">{cop(b.amount)}</td>
                      <td className="py-2 text-right text-text-primary">{cop(spent)}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-semibold ${sem.cls}`}>{sem.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gold/30 font-semibold">
                  <td colSpan={2} className="pt-2">
                    TOTAL
                  </td>
                  <td className="pt-2 text-right">{cop(totalNeeded)}</td>
                  <td className={`pt-2 text-right ${totalCovered >= totalNeeded ? "text-green-400" : "text-gold"}`}>
                    {cop(totalCovered)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-dashed border-border pt-3">
            {activeBudgets.map((b) => (
              <form key={b.id} action={deactivateBudget}>
                <input type="hidden" name="id" value={b.id} />
                <button
                  type="submit"
                  className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-red-400 hover:text-red-400"
                >
                  Desactivar {b.category}
                </button>
              </form>
            ))}
          </div>
        </div>

        <details>
          <summary className="cursor-pointer text-xs text-text-muted">+ Nueva categoría de presupuesto</summary>
          <form
            action={createBudget}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
          >
            <Field label="Categoría">
              <input type="text" name="category" required className="input" />
            </Field>
            <Field label="Meta (COP)">
              <input type="number" step="0.01" name="amount" required className="input w-32" />
            </Field>
            <Field label="Prioridad">
              <input type="number" name="priority" defaultValue={1} min={1} className="input w-20" />
            </Field>
            <button
              type="submit"
              className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
            >
              Crear
            </button>
          </form>
        </details>

        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="mb-2 text-sm font-semibold text-gold">Historial del mes</div>
          {thisMonthIncome.length === 0 ? (
            <p className="text-xs text-text-muted">Sin ingresos este mes</p>
          ) : (
            <div className="space-y-2">
              {thisMonthIncome.map((i) => (
                <div key={i.id} className="border-b border-border/50 pb-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{cop(i.amount)}</span>
                    <span className="text-xs text-text-muted">{i.date}</span>
                  </div>
                  <div className="text-xs text-text-muted">
                    {i.source}
                    {i.distributionApplied && <span className="ml-2 text-green-400">Distribuido</span>}
                  </div>
                  {i.description && <div className="text-xs text-text-dim">{i.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-gold/30 bg-bg-card p-4">
        <div className="mb-3 text-sm font-semibold text-gold">Registrar ingreso</div>
        <form action={registrarIngreso} className="flex flex-col gap-3">
          <Field label="Monto (COP)">
            <input type="number" step="0.01" name="amount" required className="input" />
          </Field>
          <Field label="Fuente">
            <select name="source" defaultValue="iarcania" className="input">
              {SOURCES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descripción">
            <input type="text" name="description" className="input" />
          </Field>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" name="distribuir" value="1" defaultChecked />
            Repartir en presupuesto por prioridad
          </label>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar ingreso
          </button>
        </form>
      </div>
    </div>
  );
}

async function PipelineTab({ userId }: { userId: string }) {
  const [deals, allClients] = await Promise.all([
    db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt)),
    db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name)),
  ]);
  const clientName = (id: string | null) => allClients.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-4">
      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nuevo deal</summary>
        <form
          action={createDeal}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre del deal">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Cliente">
            <select name="clientId" defaultValue="" className="input">
              <option value="">Sin cliente</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de servicio">
            <select name="serviceType" defaultValue="custom_agent" className="input">
              <option value="custom_agent">Agente custom</option>
              <option value="family_os">Family OS</option>
            </select>
          </Field>
          <Field label="Valor (COP)">
            <input type="number" step="0.01" name="value" className="input w-32" />
          </Field>
          <Field label="Stage inicial">
            <select name="stage" defaultValue="contacted" className="input">
              {STAGE_CFG.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar deal
          </button>
        </form>
      </details>

      <div className="grid gap-3 overflow-x-auto sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_CFG.map((s) => {
          const items = deals.filter((d) => d.stage === s.key);
          const total = items.reduce((sum, d) => sum + (d.value || 0), 0);
          return (
            <div key={s.key} className="min-w-[160px]">
              <div className="mb-2 rounded-sm bg-bg-deep px-2 py-1.5">
                <div className={`text-xs font-bold ${s.color}`}>{s.label}</div>
                <div className="text-xs text-text-muted">
                  {items.length}
                  {total > 0 ? ` · ${cop(total)}` : ""}
                </div>
              </div>
              <div className="space-y-2">
                {items.map((d) => (
                  <DealCard key={d.id} deal={d} clientName={clientName(d.clientId)} stage={s.key} />
                ))}
                {items.length === 0 && <div className="text-xs text-text-dim">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, clientName, stage }: { deal: Deal; clientName?: string; stage: string }) {
  const anticipo = deal.value ? Math.round(deal.value * (deal.anticipoPct / 100)) : null;
  return (
    <details className="rounded-md border border-border bg-bg-card p-2.5 text-xs">
      <summary className="cursor-pointer">
        <span className="font-semibold text-text-primary">{deal.name}</span>
        {clientName && <div className="text-text-muted">{clientName}</div>}
        {deal.value != null && <div className="mt-1 font-semibold text-gold">{cop(deal.value)}</div>}
      </summary>

      <div className="mt-2 space-y-2 border-t border-border pt-2">
        {anticipo && stage !== "lost" && (
          <div className="text-text-muted">
            Anticipo: {cop(anticipo)} · Resta: {cop(deal.value! - anticipo)}
            {deal.anticipoPaid && <span className="ml-1 text-green-400">✓ pagado</span>}
          </div>
        )}

        <form action={moveDealStage} className="flex flex-wrap gap-1">
          <input type="hidden" name="id" value={deal.id} />
          {STAGE_CFG.filter((x) => x.key !== stage).map((x) => (
            <button
              key={x.key}
              type="submit"
              name="stage"
              value={x.key}
              className="rounded-sm border border-border px-1.5 py-0.5 text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              {x.label}
            </button>
          ))}
        </form>

        <PagoForm dealId={deal.id} value={deal.value} anticipoPct={deal.anticipoPct} name={deal.name} />
      </div>
    </details>
  );
}

function PagoForm({
  dealId,
  value,
  anticipoPct,
  name,
}: {
  dealId: string;
  value: number | null;
  anticipoPct: number;
  name: string;
}) {
  const sugerido = value ? Math.round((value * anticipoPct) / 100) : "";
  return (
    <form action={registerDealPayment} className="space-y-1.5 rounded-sm border border-dashed border-border p-2">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex gap-1.5">
        <input
          type="number"
          step="0.01"
          name="amount"
          defaultValue={sugerido}
          placeholder="Monto"
          className="input"
        />
        <select name="source" defaultValue="iarcania" className="input">
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <input type="text" name="description" placeholder="Anticipo, saldo…" defaultValue={`Anticipo: ${name}`} className="input" />
      <label className="flex items-center gap-1 text-text-muted">
        <input type="checkbox" name="distribuir" value="1" defaultChecked />
        Repartir en presupuesto
      </label>
      <div className="flex gap-1.5">
        <button
          type="submit"
          name="markWon"
          value="1"
          className="flex-1 rounded-sm bg-gradient-cta px-2 py-1 font-semibold text-white"
        >
          🏆 Ganado + pago
        </button>
        <button
          type="submit"
          className="flex-1 rounded-sm border border-gold/30 bg-gold/10 px-2 py-1 text-gold"
        >
          💰 Solo pago
        </button>
      </div>
    </form>
  );
}

// Clientes vive en su propia sección con CRUD completo (/dashboard/clientes)
// — aquí solo un resumen + link, para no duplicar el mismo dominio en dos
// pantallas distintas. Simplificación consciente, ver NOTES.md.
async function ClientesTab({ userId }: { userId: string }) {
  const allClients = await db.select().from(clients).where(eq(clients.userId, userId));
  const byStatus = { activo: 0, inactivo: 0, pausado: 0 } as Record<string, number>;
  for (const c of allClients) byStatus[c.status] = (byStatus[c.status] || 0) + 1;

  return (
    <div className="rounded-md border border-border bg-bg-card p-4">
      <p className="text-sm text-text-muted">
        {allClients.length} cliente{allClients.length !== 1 ? "s" : ""} · {byStatus.activo || 0} activos ·{" "}
        {byStatus.pausado || 0} pausados · {byStatus.inactivo || 0} inactivos
      </p>
      <a
        href="/dashboard/clientes"
        className="mt-3 inline-block rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
      >
        Ir a Clientes →
      </a>
    </div>
  );
}

async function DeudasTab({ userId, today }: { userId: string; today: string }) {
  const allDebts = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, userId))
    .orderBy(desc(debts.remainingAmount));
  const activeDebts = allDebts.filter((d) => d.status === "active");
  const paidDebts = allDebts.filter((d) => d.status === "paid");

  const total = activeDebts.reduce((s, d) => s + d.remainingAmount, 0);
  const totalCuota = activeDebts.reduce((s, d) => s + (d.monthlyPayment || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="text-xs text-text-muted">Total adeudado</div>
          <div className="text-xl font-bold text-red-400">{cop(total)}</div>
        </div>
        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="text-xs text-text-muted">Cuotas mensuales</div>
          <div className="text-xl font-bold text-gold">{cop(totalCuota)}</div>
        </div>
      </div>

      {activeDebts.length === 0 ? (
        <p className="text-sm text-green-400">✓ Sin deudas activas</p>
      ) : (
        <div className="space-y-3">
          {activeDebts.map((d) => {
            const overdue = d.dueDate && d.dueDate <= today;
            const pct = ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100;
            const months = d.monthlyPayment ? Math.ceil(d.remainingAmount / d.monthlyPayment) : null;
            return (
              <div key={d.id} className="rounded-md border border-gold/30 bg-bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-text-primary">{d.creditor}</div>
                    <div className="text-xs text-text-muted">
                      Deudor: {d.debtor}
                      {d.monthlyPayment ? ` · Cuota: ${cop(d.monthlyPayment)}/mes` : ""}
                    </div>
                    {d.notes && <div className="mt-1 text-xs text-text-dim">{d.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-400">{cop(d.remainingAmount)}</div>
                    {d.totalAmount !== d.remainingAmount && (
                      <div className="text-xs text-text-muted">de {cop(d.totalAmount)}</div>
                    )}
                  </div>
                </div>
                <div className="my-2 h-1 rounded-full bg-bg-deep">
                  <div
                    className="h-full rounded-full bg-green-400"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={overdue ? "text-red-400" : "text-gold"}>
                    {overdue ? `● Vencida — ${d.dueDate}` : d.dueDate ? `Vence: ${d.dueDate}` : ""}
                  </span>
                  <span className="text-text-muted">
                    {months ? `~${months} meses para liquidar` : "Sin cuota fija"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <form action={registerDebtPayment} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={d.id} />
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      placeholder="Abono"
                      className="input w-24 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-sm border border-green-500/30 px-2 py-1 text-xs text-green-400 hover:border-green-400"
                    >
                      Registrar abono
                    </button>
                  </form>
                  <form action={deleteDebt}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:border-red-400"
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

      {paidDebts.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-text-muted">
            {paidDebts.length} deuda{paidDebts.length !== 1 ? "s" : ""} saldada{paidDebts.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            {paidDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border bg-bg-card p-3 text-xs">
                <div>
                  <span className="text-text-primary">{d.creditor}</span>
                  <span className="ml-2 text-text-muted">Deudor: {d.debtor}</span>
                  <span className="ml-2 text-green-400">✓ Saldada — {cop(d.totalAmount)}</span>
                </div>
                <form action={deleteDebt}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-text-muted hover:text-red-400">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nueva deuda</summary>
        <form
          action={createDebt}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Acreedor">
            <input type="text" name="creditor" required className="input" />
          </Field>
          <Field label="Deudor">
            <input type="text" name="debtor" required className="input" />
          </Field>
          <Field label="Monto total (COP)">
            <input type="number" step="0.01" name="totalAmount" required className="input w-32" />
          </Field>
          <Field label="Cuota mensual (COP)">
            <input type="number" step="0.01" name="monthlyPayment" className="input w-32" />
          </Field>
          <Field label="Vence">
            <input type="date" name="dueDate" className="input" />
          </Field>
          <Field label="Notas">
            <input type="text" name="notes" className="input w-40" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Crear
          </button>
        </form>
      </details>
    </div>
  );
}
