import { asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { appointments } from "@/lib/db/schema/citas";
import { eventTypes } from "@/lib/db/schema/eventos";
import { EVENT_TYPE_CATS } from "@/lib/constants/event-type-cats";
import { PageHeader, Badge, EmptyState, Button, Labeled, Input, Select, cx } from "@/components/ui";
import {
  createAppointment,
  completeAppointment,
  cancelAppointment,
  deleteAppointment,
} from "./actions";

type Appointment = InferSelectModel<typeof appointments>;

const CITA_ICONS: Record<string, string> = {
  medica: "🏥",
  odontologica: "🦷",
  reunion: "🤝",
  otro: "📋",
};
const STATUS: Record<string, { label: string; tone: "warm" | "success" | "neutral" }> = {
  pendiente: { label: "Pendiente", tone: "warm" },
  completada: { label: "Completada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

function fmtFecha(d: Date) {
  const s = d.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtHora(d: Date) {
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
}

export default async function CitasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const [allCitas, types] = await Promise.all([
    db.select().from(appointments).where(eq(appointments.userId, userId)).orderBy(asc(appointments.datetime)),
    db.select().from(eventTypes).where(eq(eventTypes.userId, userId)).orderBy(asc(eventTypes.name)),
  ]);

  const proximas = allCitas.filter((c) => c.status === "pendiente" && c.datetime >= now);
  const pasadas = allCitas.filter((c) => c.status !== "pendiente" || c.datetime < now);

  return (
    <div className="p-8">
      <PageHeader
        icon="🏥"
        title="Citas"
        subtitle={`${proximas.length} próxima${proximas.length !== 1 ? "s" : ""} · ${allCitas.length} en total`}
      />

      {allCitas.length === 0 ? (
        <EmptyState icon="🏥">No hay citas registradas. Agenda la primera con el formulario de abajo.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {proximas.length > 0 && (
            <section>
              <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Próximas
              </h2>
              <div className="flex flex-col gap-2">
                {proximas.map((c) => (
                  <CitaCard key={c.id} cita={c} fmtFecha={fmtFecha} fmtHora={fmtHora} />
                ))}
              </div>
            </section>
          )}
          {pasadas.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted hover:text-ink">
                Pasadas / completadas ({pasadas.length})
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {pasadas.map((c) => (
                  <CitaCard key={c.id} cita={c} fmtFecha={fmtFecha} fmtHora={fmtHora} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <form
        action={createAppointment}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <span className="w-full text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
          Nueva cita
        </span>
        <Labeled label="Título">
          <Input name="title" required className="w-56" />
        </Labeled>
        <Labeled label="Tipo">
          <Select name="type" defaultValue="otro">
            <option value="medica">🏥 Médica</option>
            <option value="odontologica">🦷 Odontológica</option>
            <option value="reunion">🤝 Reunión</option>
            <option value="otro">📋 Otro</option>
          </Select>
        </Labeled>
        <Labeled label="Fecha y hora">
          <Input type="datetime-local" name="datetime" step={600} required className="w-52" />
        </Labeled>
        <Labeled label="Duración (min)">
          <Input type="number" name="durationMinutes" defaultValue={60} min={10} step={10} className="w-24" />
        </Labeled>
        <Labeled label="Viaje antes (min)">
          <Input type="number" name="travelBeforeMinutes" min={0} className="w-24" />
        </Labeled>
        <Labeled label="Viaje después (min)">
          <Input type="number" name="travelAfterMinutes" min={0} className="w-24" />
        </Labeled>
        <Labeled label="Lugar">
          <Input name="location" className="w-44" />
        </Labeled>
        <Labeled label="Doctor/a (opcional)">
          <Input name="doctorName" className="w-44" />
        </Labeled>
        <Labeled label="Tipo de evento (opcional)">
          <Select name="eventTypeId" defaultValue="">
            <option value="">— Ninguno —</option>
            {Object.entries(EVENT_TYPE_CATS).map(([catKey, cat]) => {
              const catTypes = types.filter((t) => t.category === catKey);
              if (catTypes.length === 0) return null;
              return (
                <optgroup key={catKey} label={`${cat.icon} ${cat.label}`}>
                  {catTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </Labeled>
        <Labeled label="Recordatorio 1 (h antes)">
          <Input type="number" name="reminder1Hours" defaultValue={3} min={0} className="w-24" />
        </Labeled>
        <Labeled label="Recordatorio 2 (h antes)">
          <Input type="number" name="reminder2Hours" defaultValue={1} min={0} className="w-24" />
        </Labeled>
        <Button type="submit">+ Nueva cita</Button>
      </form>
    </div>
  );
}

function CitaCard({
  cita,
  fmtFecha,
  fmtHora,
}: {
  cita: Appointment;
  fmtFecha: (d: Date) => string;
  fmtHora: (d: Date) => string;
}) {
  const isPendiente = cita.status === "pendiente";
  const st = STATUS[cita.status] ?? { label: cita.status, tone: "neutral" as const };

  return (
    <div
      className={cx(
        "rounded-ui-lg border border-line bg-surface p-4",
        cita.status === "cancelada" && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">
            {CITA_ICONS[cita.type] ?? "📋"} {cita.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-dim">
            <span>
              📅 {fmtFecha(cita.datetime)}, {fmtHora(cita.datetime)}
            </span>
            {cita.location && <span>📍 {cita.location}</span>}
            {cita.doctorName && <span>👨‍⚕️ {cita.doctorName}</span>}
          </div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isPendiente && (
          <>
            <form action={completeAppointment}>
              <input type="hidden" name="id" value={cita.id} />
              <Button type="submit" variant="secondary" size="sm" className="border-success/40 text-success hover:border-success">
                ✓ Completar
              </Button>
            </form>
            <form action={cancelAppointment}>
              <input type="hidden" name="id" value={cita.id} />
              <Button type="submit" variant="secondary" size="sm" className="border-accent-warm/40 text-accent-warm hover:border-accent-warm">
                ✗ Cancelar
              </Button>
            </form>
          </>
        )}
        <form action={deleteAppointment}>
          <input type="hidden" name="id" value={cita.id} />
          <Button type="submit" variant="danger" size="sm">
            🗑️ Eliminar
          </Button>
        </form>
      </div>
    </div>
  );
}
