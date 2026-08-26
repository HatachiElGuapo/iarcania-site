import { asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { appointments } from "@/lib/db/schema/citas";
import { eventTypes } from "@/lib/db/schema/eventos";
import { Field } from "@/components/ui/field";
import { EVENT_TYPE_CATS } from "@/lib/constants/event-type-cats";
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

const CITA_STATUS_COLOR: Record<string, string> = {
  pendiente: "text-gold",
  completada: "text-green-400",
  cancelada: "text-text-muted",
};

const CITA_STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
};

function formatFecha(d: Date) {
  const fecha = d.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

function formatHora(d: Date) {
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

export default async function CitasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const now = new Date();

  const [allCitas, types] = await Promise.all([
    db
      .select()
      .from(appointments)
      .where(eq(appointments.userId, userId))
      .orderBy(asc(appointments.datetime)),
    db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.userId, userId))
      .orderBy(asc(eventTypes.name)),
  ]);

  const proximas = allCitas.filter((c) => c.status === "pendiente" && c.datetime >= now);
  const pasadas = allCitas.filter((c) => c.status !== "pendiente" || c.datetime < now);

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Citas</h1>

      {allCitas.length === 0 ? (
        <p className="text-sm text-text-muted">No hay citas registradas.</p>
      ) : (
        <>
          {proximas.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
                Próximas
              </h2>
              <div className="space-y-2">
                {proximas.map((c) => (
                  <CitaCard key={c.id} cita={c} />
                ))}
              </div>
            </section>
          )}

          {pasadas.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-muted">
                Pasadas / completadas ({pasadas.length})
              </summary>
              <div className="mt-3 space-y-2">
                {pasadas.map((c) => (
                  <CitaCard key={c.id} cita={c} />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <form
        action={createAppointment}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Título">
          <input type="text" name="title" required className="input" />
        </Field>
        <Field label="Tipo">
          <select name="type" defaultValue="otro" className="input">
            <option value="medica">🏥 Médica</option>
            <option value="odontologica">🦷 Odontológica</option>
            <option value="reunion">🤝 Reunión</option>
            <option value="otro">📋 Otro</option>
          </select>
        </Field>
        <Field label="Fecha y hora">
          <input type="datetime-local" name="datetime" step={600} required className="input" />
        </Field>
        <Field label="Duración (min)">
          <input type="number" name="durationMinutes" defaultValue={60} min={10} step={10} className="input" />
        </Field>
        <Field label="Viaje antes (min)">
          <input type="number" name="travelBeforeMinutes" min={0} className="input" />
        </Field>
        <Field label="Viaje después (min)">
          <input type="number" name="travelAfterMinutes" min={0} className="input" />
        </Field>
        <Field label="Lugar">
          <input type="text" name="location" className="input" />
        </Field>
        <Field label="Doctor/a (opcional)">
          <input type="text" name="doctorName" className="input" />
        </Field>
        <Field label="Tipo de evento (opcional)">
          <select name="eventTypeId" defaultValue="" className="input">
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
          </select>
        </Field>
        <Field label="Recordatorio 1 (horas antes)">
          <input type="number" name="reminder1Hours" defaultValue={3} min={0} className="input" />
        </Field>
        <Field label="Recordatorio 2 (horas antes)">
          <input type="number" name="reminder2Hours" defaultValue={1} min={0} className="input" />
        </Field>
        <button
          type="submit"
          className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          + Nueva cita
        </button>
      </form>
    </div>
  );
}

function CitaCard({ cita }: { cita: Appointment }) {
  const isPendiente = cita.status === "pendiente";

  return (
    <div
      className={`rounded-md border border-border bg-bg-card p-4 ${cita.status === "cancelada" ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">
            {CITA_ICONS[cita.type] ?? "📋"} {cita.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
            <span>
              📅 {formatFecha(cita.datetime)}, {formatHora(cita.datetime)}
            </span>
            {cita.location && <span>📍 {cita.location}</span>}
            {cita.doctorName && <span>👨‍⚕️ {cita.doctorName}</span>}
          </div>
        </div>
        <span className={`text-xs font-semibold ${CITA_STATUS_COLOR[cita.status] ?? ""}`}>
          {CITA_STATUS_LABEL[cita.status] ?? cita.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isPendiente && (
          <>
            <form action={completeAppointment}>
              <input type="hidden" name="id" value={cita.id} />
              <button
                type="submit"
                className="rounded-sm border border-green-500/40 px-3 py-1 text-xs text-green-400 hover:border-green-400"
              >
                ✓ Completar
              </button>
            </form>
            <form action={cancelAppointment}>
              <input type="hidden" name="id" value={cita.id} />
              <button
                type="submit"
                className="rounded-sm border border-gold/40 px-3 py-1 text-xs text-gold hover:border-gold"
              >
                ✗ Cancelar
              </button>
            </form>
          </>
        )}
        <form action={deleteAppointment}>
          <input type="hidden" name="id" value={cita.id} />
          <button
            type="submit"
            className="rounded-sm border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:border-red-400"
          >
            🗑️ Eliminar
          </button>
        </form>
      </div>
    </div>
  );
}
