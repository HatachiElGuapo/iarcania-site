import { desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agencyClients, agencyPayments } from "@/lib/db/schema/agencia";
import { Field } from "@/components/ui/field";
import { todayISO } from "@/lib/date/bogota";
import {
  createAgencyClient,
  updateAgencyClientStatus,
  deleteAgencyClient,
  createAgencyPayment,
  markAgencyPaymentPaid,
  deleteAgencyPayment,
} from "./actions";

type Client = InferSelectModel<typeof agencyClients>;
type Payment = InferSelectModel<typeof agencyPayments>;

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

// Cobros vive en el dominio de agencia (crm_clients/crm_payments — SB_I del
// original), distinto del dominio personal/freelance de la sección
// Clientes (clients/payments/projects/invoices — SB_P). Ver NOTES.md.
export default async function CobrosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();

  const [clients, payments] = await Promise.all([
    db.select().from(agencyClients).where(eq(agencyClients.userId, userId)).orderBy(desc(agencyClients.createdAt)),
    db.select().from(agencyPayments).where(eq(agencyPayments.userId, userId)).orderBy(desc(agencyPayments.dueDate)),
  ]);

  const pendingTotal = payments
    .filter((p) => p.status === "pendiente")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {pendingTotal > 0 && (
        <div className="rounded-md border border-gold/30 bg-bg-card px-4 py-3">
          <span className="text-lg font-bold text-gold">${pendingTotal.toLocaleString("es-CO")}</span>
          <span className="ml-2 text-xs text-text-muted">por cobrar</span>
        </div>
      )}

      {clients.length === 0 ? (
        <p className="text-sm text-text-muted">Sin clientes de agencia todavía.</p>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              clientPayments={payments.filter((p) => p.clientId === c.id)}
              today={today}
            />
          ))}
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nuevo cliente de agencia</summary>
        <form
          action={createAgencyClient}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Negocio">
            <input type="text" name="business" className="input" />
          </Field>
          <Field label="WhatsApp">
            <input type="text" name="whatsapp" className="input" />
          </Field>
          <Field label="Email">
            <input type="email" name="email" className="input" />
          </Field>
          <Field label="Servicio">
            <input type="text" name="service" className="input" />
          </Field>
          <Field label="Monto mensual">
            <input type="number" step="0.01" name="monthlyAmount" className="input w-28" />
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
  clientPayments,
  today,
}: {
  client: Client;
  clientPayments: Payment[];
  today: string;
}) {
  const totalPagado = clientPayments.filter((p) => p.status === "pagado").reduce((a, p) => a + p.amount, 0);
  const totalPendiente = clientPayments
    .filter((p) => p.status === "pendiente" || p.status === "vencido")
    .reduce((a, p) => a + p.amount, 0);

  return (
    <details className="rounded-md border border-border bg-bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-mid/20 text-sm">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{client.name}</span>
            <span className={`text-xs font-semibold ${STATUS_COLOR[client.status]}`}>{client.status}</span>
          </div>
          <div className="text-xs text-text-muted">
            {[client.business, client.service].filter(Boolean).join(" · ") || "—"}
            {client.monthlyAmount > 0 && ` · $${client.monthlyAmount.toLocaleString("es-CO")}/mes`}
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
        <div className="flex items-center gap-2">
          <form action={updateAgencyClientStatus} className="flex items-center gap-2">
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
          <form action={deleteAgencyClient}>
            <input type="hidden" name="id" value={client.id} />
            <button
              type="submit"
              className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400"
            >
              Eliminar cliente
            </button>
          </form>
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Cobros</h3>
          {clientPayments.length === 0 ? (
            <p className="text-xs text-text-muted">Sin cobros registrados</p>
          ) : (
            <div className="space-y-1">
              {clientPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted">{p.dueDate ?? "—"}</span>
                  <span className="flex-1 text-text-primary">{p.notes ?? "—"}</span>
                  <span className="text-text-primary">${p.amount.toLocaleString("es-CO")}</span>
                  <span className={PAYMENT_BADGE[p.status]}>{p.status}</span>
                  {p.status !== "pagado" && (
                    <form action={markAgencyPaymentPaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paidDate" value={today} />
                      <button type="submit" className="text-green-400 hover:underline">
                        Marcar pagado
                      </button>
                    </form>
                  )}
                  <form action={deleteAgencyPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-text-muted hover:text-red-400">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={createAgencyPayment} className="mt-2 flex flex-wrap items-end gap-2">
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
              + Cobro
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
