import { and, asc, desc, eq, gte, lte, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, projects, payments, invoices } from "@/lib/db/schema/clientes";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/app/page-header";
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

const STATUS_COLOR: Record<string, string> = {
  activo: "text-green-400",
  inactivo: "text-text-muted",
  pausado: "text-gold",
};

const PAYMENT_BADGE: Record<string, string> = {
  pagado: "text-green-400",
  pendiente: "text-gold",
  vencido: "text-red-400",
};

export default async function ClientesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { from, to } = currentMonthRangeISO();

  const [allClients, allProjects, allPayments, allInvoices] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(desc(clients.createdAt)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt)),
    db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(asc(invoices.dueDate)),
  ]);

  const cobradoEsteMes = allPayments
    .filter((p) => p.status === "pagado" && p.paidDate && p.paidDate >= from && p.paidDate <= to)
    .reduce((a, p) => a + p.amount, 0);

  const pendienteTotal = allInvoices
    .filter((i) => i.status === "pendiente" || i.status === "vencido")
    .reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-6 p-8">
      <PageHeader eyebrow="Negocio" title="Clientes" icon="🤝" />

      {allClients.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[160px] flex-1 rounded-md border border-border bg-bg-card px-4 py-3">
            <div className="stat-num text-lg">
              ${cobradoEsteMes.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-text-muted">Cobrado este mes</div>
          </div>
          <div className="min-w-[160px] flex-1 rounded-md border border-border bg-bg-card px-4 py-3">
            <div className="text-lg font-bold text-gold">
              ${pendienteTotal.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-text-muted">Pendiente por cobrar</div>
          </div>
        </div>
      )}

      {allClients.length === 0 ? (
        <p className="text-sm text-text-muted">Sin clientes todavía — cierra tu primer deal 🎯</p>
      ) : (
        <div className="space-y-3">
          {allClients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              project={allProjects.find((p) => p.clientId === c.id && p.status === "activo")}
              clientPayments={allPayments.filter((p) => p.clientId === c.id)}
              clientInvoices={allInvoices.filter(
                (i) => i.clientId === c.id && (i.status === "pendiente" || i.status === "vencido"),
              )}
              today={date}
            />
          ))}
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-text-muted hover:text-purple-light">
          + Nuevo cliente
        </summary>
        <form
          action={createClient}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border-hover/50 bg-bg-card/50 p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Negocio">
            <input type="text" name="business" className="input" />
          </Field>
          <Field label="Servicio">
            <input type="text" name="service" className="input" />
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

function ClientCard({
  client,
  project,
  clientPayments,
  clientInvoices,
  today,
}: {
  client: Client;
  project?: Project;
  clientPayments: Payment[];
  clientInvoices: Invoice[];
  today: string;
}) {
  const totalPagado = clientPayments
    .filter((p) => p.status === "pagado")
    .reduce((a, p) => a + p.amount, 0);
  const totalPendiente = clientInvoices.reduce((a, i) => a + i.amount, 0);

  return (
    <details className="card-glow p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-mid/20 text-sm font-semibold text-purple-light">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{client.name}</span>
            <span className={`text-xs font-semibold ${STATUS_COLOR[client.status]}`}>
              {client.status}
            </span>
          </div>
          <div className="text-xs text-text-muted">
            {[client.business, client.service].filter(Boolean).join(" · ") || "—"}
            {project ? ` · 📁 ${project.name}` : ""}
          </div>
          <div className="mt-1 flex gap-3 text-xs">
            <span className="text-green-400">✅ ${totalPagado.toLocaleString("es-CO")} pagado</span>
            {totalPendiente > 0 && (
              <span className="text-gold">⏳ ${totalPendiente.toLocaleString("es-CO")} pendiente</span>
            )}
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-border pt-4">
        {/* Estado + eliminar */}
        <div className="flex items-center gap-2">
          <form action={updateClientStatus} className="flex items-center gap-2">
            <input type="hidden" name="id" value={client.id} />
            <select name="status" defaultValue={client.status} className="input">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="pausado">Pausado</option>
            </select>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              Actualizar estado
            </button>
          </form>
          <form action={deleteClient}>
            <input type="hidden" name="id" value={client.id} />
            <button
              type="submit"
              className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400"
            >
              Eliminar cliente
            </button>
          </form>
        </div>

        {/* Proyecto */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Proyecto activo
          </h3>
          {project ? (
            <form action={completeProjectClient} className="flex items-center gap-2 text-sm">
              <input type="hidden" name="id" value={project.id} />
              <span className="text-text-primary">{project.name}</span>
              <button
                type="submit"
                className="rounded-sm border border-green-500/30 px-2 py-1 text-xs text-green-400 hover:border-green-400"
              >
                ✓ Completar
              </button>
            </form>
          ) : (
            <form action={createProject} className="flex items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="text" name="name" placeholder="Nombre del proyecto" required className="input flex-1" />
              <button
                type="submit"
                className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
              >
                + Proyecto
              </button>
            </form>
          )}
        </div>

        {/* Historial de pagos */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Historial de pagos
          </h3>
          {clientPayments.length === 0 ? (
            <p className="text-xs text-text-muted">Sin pagos registrados</p>
          ) : (
            <div className="space-y-1">
              {clientPayments.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted">{p.paidDate ?? p.dueDate ?? "—"}</span>
                  <span className="flex-1 text-text-primary">{p.notes ?? "—"}</span>
                  <span className="text-text-primary">${p.amount.toLocaleString("es-CO")}</span>
                  <span className={PAYMENT_BADGE[p.status]}>{p.status}</span>
                  {p.status !== "pagado" && (
                    <form action={markPaymentPaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paidDate" value={today} />
                      <button type="submit" className="text-green-400 hover:underline">
                        Marcar pagado
                      </button>
                    </form>
                  )}
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-text-muted hover:text-red-400">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createPayment} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <Field label="Monto">
              <input type="number" step="0.01" name="amount" required className="input w-28" />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue="pendiente" className="input">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
                <option value="vencido">Vencido</option>
              </select>
            </Field>
            <Field label="Vence">
              <input type="date" name="dueDate" className="input" />
            </Field>
            <Field label="Pagado el">
              <input type="date" name="paidDate" defaultValue={today} className="input" />
            </Field>
            <Field label="Nota">
              <input type="text" name="notes" className="input w-32" />
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              + Pago
            </button>
          </form>
        </div>

        {/* Invoices pendientes */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Invoices pendientes
          </h3>
          {clientInvoices.length === 0 ? (
            <p className="text-xs text-text-muted">Sin invoices pendientes 🎉</p>
          ) : (
            <div className="space-y-1">
              {clientInvoices.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted">{i.dueDate}</span>
                  <span className="flex-1 text-text-primary">{i.description ?? "—"}</span>
                  <span className="text-text-primary">${i.amount.toLocaleString("es-CO")}</span>
                  <span className={PAYMENT_BADGE[i.status]}>{i.status}</span>
                  <form action={markInvoicePaid}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-green-400 hover:underline">
                      Marcar pagada
                    </button>
                  </form>
                  <form action={deleteInvoice}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-text-muted hover:text-red-400">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createInvoice} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <Field label="Monto">
              <input type="number" step="0.01" name="amount" required className="input w-28" />
            </Field>
            <Field label="Vence">
              <input type="date" name="dueDate" required className="input" />
            </Field>
            <Field label="Descripción">
              <input type="text" name="description" className="input w-40" />
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              + Invoice
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
