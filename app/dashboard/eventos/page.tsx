import { asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { eventTypes, eventOccurrences } from "@/lib/db/schema/eventos";
import { Field } from "@/components/ui/field";
import { EVENT_TYPE_CATS } from "@/lib/constants/event-type-cats";
import {
  seedEventTypeDefaults,
  saveEventType,
  deleteEventType,
  saveOccurrence,
  deleteOccurrence,
} from "./actions";
import { todayISO } from "@/lib/date/bogota";

type EventType = InferSelectModel<typeof eventTypes>;
type Occurrence = InferSelectModel<typeof eventOccurrences>;

const MOOD_MAP: Record<string, string> = { genial: "😊", normal: "😐", dificil: "😔" };

export default async function EventosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const types = await db
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.userId, userId))
    .orderBy(asc(eventTypes.name));

  const occurrences =
    types.length === 0
      ? []
      : await db
          .select()
          .from(eventOccurrences)
          .where(eq(eventOccurrences.userId, userId))
          .orderBy(desc(eventOccurrences.date));

  const occurrencesByType = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const list = occurrencesByType.get(o.eventTypeId) ?? [];
    list.push(o);
    occurrencesByType.set(o.eventTypeId, list);
  }

  return (
    <div className="space-y-8 p-8">
      <h1 className="font-display text-2xl text-text-primary">Eventos</h1>

      {types.length === 0 ? (
        <div className="rounded-md border border-border bg-bg-card p-8 text-center">
          <p className="mb-4 text-sm text-text-muted">Sin tipos de evento todavía.</p>
          <form action={seedEventTypeDefaults}>
            <button
              type="submit"
              className="rounded-sm border border-purple-mid/40 bg-purple-mid/10 px-4 py-2 text-sm font-semibold text-purple-light"
            >
              🌱 Cargar tipos básicos
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(EVENT_TYPE_CATS).map(([catKey, cat]) => {
            const catTypes = types.filter((t) => t.category === catKey);
            if (catTypes.length === 0) return null;
            return (
              <details key={catKey} open className="space-y-2">
                <summary className="flex cursor-pointer items-center gap-2 pb-2">
                  <span>{cat.icon}</span>
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <span className="text-xs text-text-muted">({catTypes.length})</span>
                  <div className="h-px flex-1 bg-border" />
                </summary>

                <div className="space-y-2">
                  {catTypes.map((et) => (
                    <EventTypeCard
                      key={et.id}
                      eventType={et}
                      icon={cat.icon}
                      occurrences={occurrencesByType.get(et.id) ?? []}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <form
        action={saveEventType}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Nombre">
          <input type="text" name="name" required className="input" />
        </Field>
        <Field label="Categoría">
          <select name="category" defaultValue="visita" className="input">
            {Object.entries(EVENT_TYPE_CATS).map(([key, c]) => (
              <option key={key} value={key}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción">
          <input type="text" name="description" className="input w-64" />
        </Field>
        <button
          type="submit"
          className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          + Nuevo tipo
        </button>
      </form>
    </div>
  );
}

function EventTypeCard({
  eventType,
  icon,
  occurrences,
}: {
  eventType: EventType;
  icon: string;
  occurrences: Occurrence[];
}) {
  return (
    <details className="rounded-md border border-border bg-bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <span className="text-lg">{icon}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">{eventType.name}</div>
          {eventType.description && (
            <div className="text-xs text-text-muted">{eventType.description}</div>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {occurrences.length} {occurrences.length === 1 ? "vez" : "veces"}
        </span>
      </summary>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        {occurrences.length === 0 ? (
          <p className="text-xs text-text-muted">Sin registros todavía.</p>
        ) : (
          <div className="space-y-2">
            {occurrences.map((o) => (
              <div key={o.id} className="rounded-md bg-bg-deep/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span>📅 {o.date}</span>
                  {o.people && <span>👤 {o.people}</span>}
                  {o.location && <span>📍 {o.location}</span>}
                  {o.cost != null && <span>💰 ${o.cost.toLocaleString("es-CO")}</span>}
                  {o.mood && <span>{MOOD_MAP[o.mood]}</span>}
                  <form action={deleteOccurrence} className="ml-auto">
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="text-text-muted hover:text-red-400">
                      Eliminar
                    </button>
                  </form>
                </div>
                {o.notes && <p className="mt-1 text-xs text-text-dim">{o.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <form
          action={saveOccurrence}
          className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="eventTypeId" value={eventType.id} />
          <Field label="Fecha">
            <input
              type="date"
              name="date"
              defaultValue={todayISO()}
              required
              className="input"
            />
          </Field>
          <Field label="Con quién">
            <input type="text" name="people" className="input" />
          </Field>
          <Field label="Lugar">
            <input type="text" name="location" className="input" />
          </Field>
          <Field label="Costo">
            <input type="number" step="0.01" name="cost" className="input" />
          </Field>
          <Field label="Cómo te fue">
            <select name="mood" defaultValue="" className="input">
              <option value="">—</option>
              <option value="genial">😊 Genial</option>
              <option value="normal">😐 Normal</option>
              <option value="dificil">😔 Difícil</option>
            </select>
          </Field>
          <input type="text" name="notes" placeholder="Notas" className="input w-full" />
          <button
            type="submit"
            className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            + Registrar vez
          </button>
        </form>

        <details>
          <summary className="cursor-pointer text-xs text-text-muted">Editar tipo</summary>
          <form
            action={saveEventType}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
          >
            <input type="hidden" name="id" value={eventType.id} />
            <Field label="Nombre">
              <input
                type="text"
                name="name"
                defaultValue={eventType.name}
                required
                className="input"
              />
            </Field>
            <Field label="Categoría">
              <select name="category" defaultValue={eventType.category} className="input">
                {Object.entries(EVENT_TYPE_CATS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descripción">
              <input
                type="text"
                name="description"
                defaultValue={eventType.description ?? ""}
                className="input w-64"
              />
            </Field>
            <button
              type="submit"
              className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
            >
              Guardar
            </button>
            <button
              type="submit"
              formAction={deleteEventType}
              className="rounded-sm border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-400"
            >
              Eliminar tipo
            </button>
          </form>
        </details>
      </div>
    </details>
  );
}
