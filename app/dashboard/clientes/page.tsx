import { asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, projects, payments, invoices } from "@/lib/db/schema/clientes";
import {
  PageHeader,
  MetricCard,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { todayISO, currentMonthRangeISO } from "@/lib/date/bogota";
import {
  createClient,
  updateClientStatus,
  deleteClient,
  createProject,
  completeProjectClient,
  createPayment,
  markPaymentPaid,
  deletePayment,
  createInvoice,
  markInvoicePaid,
  deleteInvoice,
} from "./actions";

type Client = InferSelectModel<typeof clients>;
type Project = InferSelectModel<typeof projects>;
type Payment = InferSelectModel<typeof payments>;
type Invoice = InferSelectModel<typeof invoices>;

const CLIENT_STATUS: Record<string, "success" | "neutral" | "warm"> = {
  activo: "success",
  inactivo: "neutral",
  pausado: "warm",
};
const PAY_STATUS: Record<string, "success" | "warm" | "danger"> = {
  pagado: "success",
  pendiente: "warm",
  vencido: "danger",
};

export default async function ClientesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = currentMonthRangeISO();

  const [allClients, allProjects, allPayments, allInvoices] = await Promise.all([
    db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)),
    db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(asc(invoices.dueDate)),
  ]);

  const cobradoEsteMes = allPayments
    .filter((p) => p.status === "pagado" && p.paidDate && p.paidDate >= from && p.paidDate <= to)
    .reduce((a, p) => a + p.amount, 0);

  const pendienteTotal = allInvoices
    .filter((i) => i.status === "pendiente" || i.status === "vencido")
    .reduce((a, i) => a + i.amount, 0);

  const activos = allClients.filter((c) => c.status === "activo").length;

  return (
    <div className="p-8">
      <PageHeader
        icon="👥"
        title="Clientes"
        subtitle={
          allClients.length > 0
            ? `${allClients.length} cliente${allClients.length !== 1 ? "s" : ""} · ${activos} activo${activos !== 1 ? "s" : ""}`
            : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {allClients.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <MetricCard value={`$${cobradoEsteMes.toLocaleString("es-CO")}`} label="Cobrado este mes" tone="success" />
            <MetricCard value={`$${pendienteTotal.toLocaleString("es-CO")}`} label="Pendiente por cobrar" tone="warm" />
          </div>
        )}

        {allClients.length === 0 ? (
          <EmptyState icon="🎯">
            Todavía no has registrado ningún cliente. Cuando cierres tu primer deal, créalo abajo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {allClients.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                project={allProjects.find((p) => p.clientId === c.id && p.status === "activo")}
                clientPayments={allPayments.filter((p) => p.clientId === c.id)}
                clientInvoices={allInvoices.filter(
                  (i) => i.clientId === c.id && (i.status === "pendiente" || i.status === "vencido"),
                )}
                counts={{
                  projects: allProjects.filter((p) => p.clientId === c.id).length,
                  payments: allPayments.filter((p) => p.clientId === c.id).length,
                  invoices: allInvoices.filter((i) => i.clientId === c.id).length,
                }}
                today={date}
              />
            ))}
          </div>
        )}

        <details>
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nuevo cliente</summary>
          <form
            action={createClient}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
          >
            <Labeled label="Nombre">
              <Input name="name" required className="w-44" />
            </Labeled>
            <Labeled label="Negocio">
              <Input name="business" className="w-44" />
            </Labeled>
            <Labeled label="Servicio">
              <Input name="service" className="w-44" />
            </Labeled>
            <Button type="submit">Crear</Button>
          </form>
        </details>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  project,
  clientPayments,
  clientInvoices,
  counts,
  today,
}: {
  client: Client;
  project?: Project;
  clientPayments: Payment[];
  clientInvoices: Invoice[];
  counts: { projects: number; payments: number; invoices: number };
  today: string;
}) {
  const totalPagado = clientPayments.filter((p) => p.status === "pagado").reduce((a, p) => a + p.amount, 0);
  const totalPendiente = clientInvoices.reduce((a, i) => a + i.amount, 0);

  const cascade: string[] = [];
  if (counts.projects) cascade.push(`${counts.projects} proyecto${counts.projects !== 1 ? "s" : ""}`);
  if (counts.payments) cascade.push(`${counts.payments} pago${counts.payments !== 1 ? "s" : ""}`);
  if (counts.invoices) cascade.push(`${counts.invoices} invoice${counts.invoices !== 1 ? "s" : ""}`);

  return (
    <details className="rounded-ui-lg border border-line bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-accent-warm/20 bg-accent-warm/10 font-display text-sm text-accent-warm">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{client.name}</span>
            <Badge tone={CLIENT_STATUS[client.status] ?? "neutral"}>{client.status}</Badge>
          </div>
          <div className="truncate text-meta text-ink-dim">
            {[client.business, client.service].filter(Boolean).join(" · ") || "—"}
            {project ? ` · 📁 ${project.name}` : ""}
          </div>
          <div className="mt-1 flex gap-3 text-meta tabular-nums">
            <span className="text-success">✅ ${totalPagado.toLocaleString("es-CO")} pagado</span>
            {totalPendiente > 0 && (
              <span className="text-accent-warm">⏳ ${totalPendiente.toLocaleString("es-CO")} pendiente</span>
            )}
          </div>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
        {/* Estado + eliminar */}
        <div className="flex flex-wrap items-center gap-2">
          <form action={updateClientStatus} className="flex items-center gap-2">
            <input type="hidden" name="id" value={client.id} />
            <Select name="status" defaultValue={client.status}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="pausado">Pausado</option>
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Actualizar estado
            </Button>
          </form>
          <ConfirmDialog
            trigger={
              <Button variant="danger" size="sm">
                Eliminar cliente
              </Button>
            }
            title={`¿Eliminar a «${client.name}»?`}
            body={
              cascade.length
                ? `Se borran también ${cascade.join(", ")} (incluidos los pagados). No se puede deshacer.`
                : "No tiene proyectos ni pagos registrados. No se puede deshacer."
            }
            confirmLabel="Eliminar cliente"
            action={deleteClient}
            hidden={{ id: client.id }}
          />
        </div>

        {/* Proyecto */}
        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Proyecto activo
          </h3>
          {project ? (
            <form action={completeProjectClient} className="flex items-center gap-2 text-body">
              <input type="hidden" name="id" value={project.id} />
              <span className="text-ink">{project.name}</span>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="border-success/30 text-success hover:border-success"
              >
                ✓ Completar
              </Button>
            </form>
          ) : (
            <form action={createProject} className="flex items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <Input name="name" placeholder="Nombre del proyecto" required className="flex-1" />
              <Button type="submit" variant="secondary" size="sm">
                + Proyecto
              </Button>
            </form>
          )}
        </div>

        {/* Historial de pagos */}
        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Historial de pagos
          </h3>
          {clientPayments.length === 0 ? (
            <p className="text-meta text-ink-muted">Sin pagos registrados.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {clientPayments.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-meta">
                  <span className="tabular-nums text-ink-dim">{p.paidDate ?? p.dueDate ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-ink" title={p.notes ?? undefined}>
                    {p.notes ?? "—"}
                  </span>
                  <span className="tabular-nums text-ink">${p.amount.toLocaleString("es-CO")}</span>
                  <Badge tone={PAY_STATUS[p.status] ?? "neutral"}>{p.status}</Badge>
                  {p.status !== "pagado" && (
                    <form action={markPaymentPaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paidDate" value={today} />
                      <button type="submit" className="text-success hover:underline">
                        Marcar pagado
                      </button>
                    </form>
                  )}
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-ink-dim hover:text-danger">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createPayment} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <Labeled label="Monto">
              <Input type="number" step="0.01" name="amount" required className="w-28" />
            </Labeled>
            <Labeled label="Estado">
              <Select name="status" defaultValue="pendiente">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
                <option value="vencido">Vencido</option>
              </Select>
            </Labeled>
            <Labeled label="Vence">
              <Input type="date" name="dueDate" className="w-40" />
            </Labeled>
            <Labeled label="Pagado el">
              <Input type="date" name="paidDate" defaultValue={today} className="w-40" />
            </Labeled>
            <Labeled label="Nota">
              <Input name="notes" className="w-32" />
            </Labeled>
            <Button type="submit" variant="secondary" size="sm">
              + Pago
            </Button>
          </form>
        </div>

        {/* Invoices pendientes */}
        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Invoices pendientes
          </h3>
          {clientInvoices.length === 0 ? (
            <p className="text-meta text-ink-muted">Sin invoices pendientes 🎉</p>
          ) : (
            <div className="flex flex-col gap-1">
              {clientInvoices.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-meta">
                  <span className="tabular-nums text-ink-dim">{i.dueDate}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{i.description ?? "—"}</span>
                  <span className="tabular-nums text-ink">${i.amount.toLocaleString("es-CO")}</span>
                  <Badge tone={PAY_STATUS[i.status] ?? "neutral"}>{i.status}</Badge>
                  <form action={markInvoicePaid}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-success hover:underline">
                      Marcar pagada
                    </button>
                  </form>
                  <form action={deleteInvoice}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-ink-dim hover:text-danger">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createInvoice} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <Labeled label="Monto">
              <Input type="number" step="0.01" name="amount" required className="w-28" />
            </Labeled>
            <Labeled label="Vence">
              <Input type="date" name="dueDate" required className="w-40" />
            </Labeled>
            <Labeled label="Descripción">
              <Input name="description" className="w-40" />
            </Labeled>
            <Button type="submit" variant="secondary" size="sm">
              + Invoice
            </Button>
          </form>
        </div>
      </div>
    </details>
  );
}
