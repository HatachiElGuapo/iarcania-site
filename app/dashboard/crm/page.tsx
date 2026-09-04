import { and, asc, desc, eq, inArray, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets, budgetDistributions, debts } from "@/lib/db/schema/crm";
import { income } from "@/lib/db/schema/dinero";
import { clients, projects } from "@/lib/db/schema/clientes";
import { todayISO } from "@/lib/date/bogota";
import {
  PageHeader,
  Section,
  Segmented,
  Table,
  TableHead,
  TableRow,
  MetricCard,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Select,
  Button,
  cx,
} from "@/components/ui";
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

// Sub-vistas por ?tab= sobre una sola página (no rutas). No se convierten.
const TABS = [
  { id: "presupuesto", label: "💰 Presupuesto" },
  { id: "pipeline", label: "📊 Pipeline" },
  { id: "clientes", label: "👥 Clientes" },
  { id: "deudas", label: "🔴 Deudas" },
];

const STAGE_CFG = [
  { key: "contacted", label: "Contactado", color: "text-ink-muted" },
  { key: "demo", label: "Demo", color: "text-accent" },
  { key: "proposal", label: "Propuesta", color: "text-accent-warm" },
  { key: "negotiation", label: "Negociación", color: "text-accent-warm" },
  { key: "won", label: "Ganado", color: "text-success" },
  { key: "lost", label: "Perdido", color: "text-danger" },
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
    <div className="p-8">
      <PageHeader
        icon="📊"
        title="CRM"
        tabs={
          <Segmented
            className="border-0"
            options={TABS.map((t) => ({
              label: t.label,
              href: t.id === "presupuesto" ? "/dashboard/crm" : `/dashboard/crm?tab=${t.id}`,
              active: tab === t.id,
            }))}
          />
        }
      />

      {tab === "presupuesto" && <PresupuestoTab userId={userId} month={month} year={year} />}
      {tab === "pipeline" && <PipelineTab userId={userId} />}
      {tab === "clientes" && <ClientesTab userId={userId} />}
      {tab === "deudas" && <DeudasTab userId={userId} today={today} />}
    </div>
  );
}

async function PresupuestoTab({ userId, month, year }: { userId: string; month: number; year: number }) {
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
  const thisMonthIncome = monthIncome.filter((i) =>
    i.date.startsWith(`${year}-${String(month).padStart(2, "0")}`),
  );

  const COLS = "40px minmax(0,1fr) 110px 110px 110px";

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {activeBudgets.length === 0 ? (
          <EmptyState icon="💰">
            El reparto de ingresos por prioridad. Todavía no has creado ninguna categoría de
            presupuesto para este mes — agrega la primera abajo.
          </EmptyState>
        ) : (
          <Table>
            <TableHead cols={COLS}>
              <span>#</span>
              <span>Categoría</span>
              <span className="text-right">Meta</span>
              <span className="text-right">Asignado</span>
              <span className="text-right">Estado</span>
            </TableHead>
            {activeBudgets.map((b) => {
              const spent = spentFor(b);
              const sem =
                spent >= b.amount
                  ? { label: "Cubierto", tone: "success" as const }
                  : spent > 0
                    ? { label: "Parcial", tone: "warm" as const }
                    : { label: "Sin cubrir", tone: "danger" as const };
              return (
                <TableRow key={b.id} cols={COLS}>
                  <span className="tabular-nums text-ink-dim">{b.priority}</span>
                  <span className="truncate text-ink">{b.category}</span>
                  <span className="text-right tabular-nums text-ink-muted">{cop(b.amount)}</span>
                  <span className="text-right tabular-nums text-ink">{cop(spent)}</span>
                  <span className="flex justify-end">
                    <Badge tone={sem.tone}>{sem.label}</Badge>
                  </span>
                </TableRow>
              );
            })}
            <div className="grid gap-2.5 border-t border-line-strong px-3.5 py-2 text-body font-semibold" style={{ gridTemplateColumns: COLS }}>
              <span />
              <span>TOTAL</span>
              <span className="text-right tabular-nums">{cop(totalNeeded)}</span>
              <span className={cx("text-right tabular-nums", totalCovered >= totalNeeded ? "text-success" : "text-accent-warm")}>
                {cop(totalCovered)}
              </span>
              <span />
            </div>
          </Table>
        )}

        {activeBudgets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeBudgets.map((b) => (
              <form key={b.id} action={deactivateBudget}>
                <input type="hidden" name="id" value={b.id} />
                <button
                  type="submit"
                  className="focus-ring rounded-ui border border-line px-2 py-1 text-meta text-ink-muted transition-colors duration-120 hover:border-danger hover:text-danger"
                >
                  Desactivar {b.category}
                </button>
              </form>
            ))}
          </div>
        )}

        <details>
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
            + Nueva categoría de presupuesto
          </summary>
          <form
            action={createBudget}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
          >
            <Labeled label="Categoría">
              <Input name="category" required className="w-44" />
            </Labeled>
            <Labeled label="Meta (COP)">
              <Input type="number" step="0.01" name="amount" required className="w-32" />
            </Labeled>
            <Labeled label="Prioridad">
              <Input type="number" name="priority" defaultValue={1} min={1} className="w-20" />
            </Labeled>
            <Button type="submit">Crear</Button>
          </form>
        </details>

        <Section title="Historial del mes">
          {thisMonthIncome.length === 0 ? (
            <p className="text-meta text-ink-muted">Sin ingresos este mes.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {thisMonthIncome.map((i) => (
                <div key={i.id} className="border-b border-line pb-2 text-body last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tabular-nums text-ink">{cop(i.amount)}</span>
                    <span className="text-meta tabular-nums text-ink-dim">{i.date}</span>
                  </div>
                  <div className="text-meta text-ink-muted">
                    {i.source}
                    {i.distributionApplied && <span className="ml-2 text-success">Distribuido</span>}
                  </div>
                  {i.description && <div className="text-meta text-ink-dim">{i.description}</div>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="rounded-ui-lg border border-accent-warm/25 bg-accent-warm/[0.06] p-4">
        <div className="mb-3 text-sm font-semibold text-accent-warm">Registrar ingreso</div>
        <form action={registrarIngreso} className="flex flex-col gap-3">
          <Labeled label="Monto (COP)">
            <Input type="number" step="0.01" name="amount" required className="w-full" />
          </Labeled>
          <Labeled label="Fuente">
            <Select name="source" defaultValue="iarcania" className="w-full">
              {SOURCES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Descripción">
            <Input name="description" className="w-full" />
          </Labeled>
          <label className="flex items-center gap-2 text-meta text-ink-muted">
            <input type="checkbox" name="distribuir" value="1" defaultChecked />
            Repartir en presupuesto por prioridad
          </label>
          <Button type="submit">Guardar ingreso</Button>
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
    <div className="mt-6 flex flex-col gap-4">
      <details>
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nuevo deal</summary>
        <form
          action={createDeal}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Nombre del deal">
            <Input name="name" required className="w-52" />
          </Labeled>
          <Labeled label="Cliente">
            <Select name="clientId" defaultValue="">
              <option value="">Sin cliente</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Tipo de servicio">
            <Select name="serviceType" defaultValue="custom_agent">
              <option value="custom_agent">Agente custom</option>
              <option value="family_os">Family OS</option>
            </Select>
          </Labeled>
          <Labeled label="Valor (COP)">
            <Input type="number" step="0.01" name="value" className="w-32" />
          </Labeled>
          <Labeled label="Stage inicial">
            <Select name="stage" defaultValue="contacted">
              {STAGE_CFG.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Button type="submit">Guardar deal</Button>
        </form>
      </details>

      <div className="grid gap-3 overflow-x-auto sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_CFG.map((s) => {
          const items = deals.filter((d) => d.stage === s.key);
          const total = items.reduce((sum, d) => sum + (d.value || 0), 0);
          return (
            <div key={s.key} className="min-w-[160px]">
              <div className="mb-2 rounded-ui border border-line bg-surface-2 px-2 py-1.5">
                <div className={cx("text-meta font-bold", s.color)}>{s.label}</div>
                <div className="text-meta tabular-nums text-ink-dim">
                  {items.length}
                  {total > 0 ? ` · ${cop(total)}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((d) => (
                  <DealCard key={d.id} deal={d} clientName={clientName(d.clientId)} stage={s.key} />
                ))}
                {items.length === 0 && <div className="text-meta text-ink-dim">—</div>}
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
    <details className="rounded-ui border border-line bg-surface p-2.5 text-meta">
      <summary className="cursor-pointer">
        <span className="font-semibold text-ink">{deal.name}</span>
        {clientName && <div className="text-ink-muted">{clientName}</div>}
        {deal.value != null && <div className="mt-1 font-semibold tabular-nums text-accent-warm">{cop(deal.value)}</div>}
      </summary>

      <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
        {anticipo && stage !== "lost" && (
          <div className="tabular-nums text-ink-muted">
            Anticipo: {cop(anticipo)} · Resta: {cop(deal.value! - anticipo)}
            {deal.anticipoPaid && <span className="ml-1 text-success">✓ pagado</span>}
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
              className="focus-ring rounded-ui border border-line px-1.5 py-0.5 text-ink-muted transition-colors duration-120 hover:border-line-strong hover:text-ink"
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
    <form
      action={registerDealPayment}
      className="flex flex-col gap-1.5 rounded-ui border border-dashed border-line p-2"
    >
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex gap-1.5">
        <Input type="number" step="0.01" name="amount" defaultValue={sugerido} placeholder="Monto" className="w-full" />
        <Select name="source" defaultValue="iarcania" className="w-full">
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <Input name="description" placeholder="Anticipo, saldo…" defaultValue={`Anticipo: ${name}`} className="w-full" />
      <label className="flex items-center gap-1 text-ink-muted">
        <input type="checkbox" name="distribuir" value="1" defaultChecked />
        Repartir en presupuesto
      </label>
      <div className="flex gap-1.5">
        <button
          type="submit"
          name="markWon"
          value="1"
          className="focus-ring flex-1 rounded-ui bg-accent px-2 py-1 font-semibold text-white transition-colors duration-120 hover:bg-accent/90"
        >
          🏆 Ganado + pago
        </button>
        <button
          type="submit"
          className="focus-ring flex-1 rounded-ui border border-accent-warm/30 bg-accent-warm/10 px-2 py-1 text-accent-warm transition-colors duration-120 hover:border-accent-warm"
        >
          💰 Solo pago
        </button>
      </div>
    </form>
  );
}

// Clientes vive en su propia sección con CRUD completo (/dashboard/clientes)
// — aquí solo un resumen + link, para no duplicar el mismo dominio.
async function ClientesTab({ userId }: { userId: string }) {
  const allClients = await db.select().from(clients).where(eq(clients.userId, userId));
  const byStatus = { activo: 0, inactivo: 0, pausado: 0 } as Record<string, number>;
  for (const c of allClients) byStatus[c.status] = (byStatus[c.status] || 0) + 1;

  return (
    <div className="mt-6 rounded-ui-lg border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">
        {allClients.length} cliente{allClients.length !== 1 ? "s" : ""} · {byStatus.activo || 0} activos ·{" "}
        {byStatus.pausado || 0} pausados · {byStatus.inactivo || 0} inactivos
      </p>
      <Button href="/dashboard/clientes" className="mt-3">
        Ir a Clientes →
      </Button>
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
    <div className="mt-6 flex flex-col gap-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <MetricCard value={cop(total)} label="Total adeudado" tone="danger" />
        <MetricCard value={cop(totalCuota)} label="Cuotas mensuales" tone="warm" />
      </div>

      {activeDebts.length === 0 ? (
        <p className="text-sm text-success">✓ Sin deudas activas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeDebts.map((d) => {
            const overdue = d.dueDate && d.dueDate <= today;
            const pct = ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100;
            const months = d.monthlyPayment ? Math.ceil(d.remainingAmount / d.monthlyPayment) : null;
            return (
              <div key={d.id} className="rounded-ui-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{d.creditor}</div>
                    <div className="text-meta text-ink-dim">
                      Deudor: {d.debtor}
                      {d.monthlyPayment ? ` · Cuota: ${cop(d.monthlyPayment)}/mes` : ""}
                    </div>
                    {d.notes && <div className="mt-1 text-meta text-ink-dim">{d.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-danger">{cop(d.remainingAmount)}</div>
                    {d.totalAmount !== d.remainingAmount && (
                      <div className="text-meta tabular-nums text-ink-dim">de {cop(d.totalAmount)}</div>
                    )}
                  </div>
                </div>
                <div className="my-2 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between text-meta">
                  <span className={overdue ? "text-danger" : "text-accent-warm"}>
                    {overdue ? `● Vencida — ${d.dueDate}` : d.dueDate ? `Vence: ${d.dueDate}` : ""}
                  </span>
                  <span className="text-ink-dim">
                    {months ? `~${months} meses para liquidar` : "Sin cuota fija"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <form action={registerDebtPayment} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={d.id} />
                    <Input type="number" step="0.01" name="amount" placeholder="Abono" className="w-24" />
                    <Button type="submit" variant="secondary" size="sm" className="border-success/30 text-success hover:border-success">
                      Registrar abono
                    </Button>
                  </form>
                  <form action={deleteDebt}>
                    <input type="hidden" name="id" value={d.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Eliminar
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paidDebts.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
            {paidDebts.length} deuda{paidDebts.length !== 1 ? "s" : ""} saldada
            {paidDebts.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {paidDebts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-ui border border-line bg-surface p-3 text-meta"
              >
                <div>
                  <span className="text-ink">{d.creditor}</span>
                  <span className="ml-2 text-ink-dim">Deudor: {d.debtor}</span>
                  <span className="ml-2 text-success">✓ Saldada — {cop(d.totalAmount)}</span>
                </div>
                <form action={deleteDebt}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-ink-dim hover:text-danger">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nueva deuda</summary>
        <form
          action={createDebt}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Acreedor">
            <Input name="creditor" required className="w-44" />
          </Labeled>
          <Labeled label="Deudor">
            <Input name="debtor" required className="w-44" />
          </Labeled>
          <Labeled label="Monto total (COP)">
            <Input type="number" step="0.01" name="totalAmount" required className="w-32" />
          </Labeled>
          <Labeled label="Cuota mensual (COP)">
            <Input type="number" step="0.01" name="monthlyPayment" className="w-32" />
          </Labeled>
          <Labeled label="Vence">
            <Input type="date" name="dueDate" className="w-40" />
          </Labeled>
          <Labeled label="Notas">
            <Input name="notes" className="w-40" />
          </Labeled>
          <Button type="submit">Crear</Button>
        </form>
      </details>
    </div>
  );
}
