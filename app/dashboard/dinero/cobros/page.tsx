import { desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agencyClients, agencyPayments } from "@/lib/db/schema/agencia";
import { Badge, EmptyState, Labeled, Input, Select, Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

const CLIENT_STATUS: Record<string, "success" | "neutral" | "warm"> = {
  activo: "success",
  inactivo: "neutral",
  pausado: "warm",
};
const PAYMENT_STATUS: Record<string, "success" | "warm" | "danger"> = {
  pagado: "success",
  pendiente: "warm",
  vencido: "danger",
};

// Cobros vive en el dominio de agencia (crm_clients/crm_payments — SB_I del
// original), distinto del dominio personal/freelance de la sección Clientes
// (clients/payments/projects/invoices — SB_P). Ver NOTES.md.
//
// El status de un cobro NO se computa (no hay lógica dueDate<hoy → vencido),
// y el banner suma solo 'pendiente' mientras el total por cliente suma
// 'pendiente'|'vencido' — deuda de lógica documentada en
// docs/migracion-rebranding.md, NO se toca en la migración de estilo.
export default async function CobrosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();

  const [clients, payments] = await Promise.all([
    db.select().from(agencyClients).where(eq(agencyClients.userId, userId)).orderBy(desc(agencyClients.createdAt)),
    db.select().from(agencyPayments).where(eq(agencyPayments.userId, userId)).orderBy(desc(agencyPayments.dueDate)),
  ]);

  const pendingTotal = payments.filter((p) => p.status === "pendiente").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      {pendingTotal > 0 && (
        <div className="rounded-ui-lg border border-accent-warm/25 bg-accent-warm/[0.06] px-4 py-3">
          <span className="text-lg font-bold tabular-nums text-accent-warm">
            ${pendingTotal.toLocaleString("es-CO")}
          </span>
          <span className="ml-2 text-meta text-ink-dim">por cobrar</span>
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState icon="🤝">
          Los clientes de tu agencia y sus cobros mensuales. Todavía no has registrado ninguno —
          crea el primero abajo.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
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
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          + Nuevo cliente de agencia
        </summary>
        <form
          action={createAgencyClient}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Nombre">
            <Input name="name" required className="w-44" />
          </Labeled>
          <Labeled label="Negocio">
            <Input name="business" className="w-44" />
          </Labeled>
          <Labeled label="WhatsApp">
            <Input name="whatsapp" className="w-36" />
          </Labeled>
          <Labeled label="Email">
            <Input type="email" name="email" className="w-48" />
          </Labeled>
          <Labeled label="Servicio">
            <Input name="service" className="w-44" />
          </Labeled>
          <Labeled label="Monto mensual">
            <Input type="number" step="0.01" name="monthlyAmount" className="w-28" />
          </Labeled>
          <Button type="submit">Crear</Button>
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
  const n = clientPayments.length;

  return (
    <details className="rounded-ui-lg border border-line bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{client.name}</span>
            <Badge tone={CLIENT_STATUS[client.status] ?? "neutral"}>{client.status}</Badge>
          </div>
          <div className="truncate text-meta text-ink-dim">
            {[client.business, client.service].filter(Boolean).join(" · ") || "—"}
            {client.monthlyAmount > 0 && ` · $${client.monthlyAmount.toLocaleString("es-CO")}/mes`}
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
        <div className="flex flex-wrap items-center gap-2">
          <form action={updateAgencyClientStatus} className="flex items-center gap-2">
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
              n > 0
                ? `Se borran también sus ${n} cobro${n !== 1 ? "s" : ""} (incluidos los pagados). No se puede deshacer.`
                : "No tiene cobros registrados. No se puede deshacer."
            }
            confirmLabel="Eliminar cliente"
            action={deleteAgencyClient}
            hidden={{ id: client.id }}
          />
        </div>

        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Cobros
          </h3>
          {clientPayments.length === 0 ? (
            <p className="text-meta text-ink-muted">Sin cobros registrados.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {clientPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-meta">
                  <span className="tabular-nums text-ink-dim">{p.dueDate ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-ink" title={p.notes ?? undefined}>
                    {p.notes ?? "—"}
                  </span>
                  <span className="tabular-nums text-ink">${p.amount.toLocaleString("es-CO")}</span>
                  <Badge tone={PAYMENT_STATUS[p.status] ?? "neutral"}>{p.status}</Badge>
                  {p.status !== "pagado" && (
                    <form action={markAgencyPaymentPaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="paidDate" value={today} />
                      <button type="submit" className="text-success hover:underline">
                        Marcar pagado
                      </button>
                    </form>
                  )}
                  <form action={deleteAgencyPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-ink-dim hover:text-danger">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <form action={createAgencyPayment} className="mt-2 flex flex-wrap items-end gap-2">
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
            <Button type="submit" variant="secondary">
              + Cobro
            </Button>
          </form>
        </div>
      </div>
    </details>
  );
}
