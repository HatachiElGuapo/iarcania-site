import { asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { eventTypes, eventOccurrences } from "@/lib/db/schema/eventos";
import { EVENT_TYPE_CATS } from "@/lib/constants/event-type-cats";
import { PageHeader, Card, EmptyState, Button, Labeled, Input, Select } from "@/components/ui";
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

  const byType = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const list = byType.get(o.eventTypeId) ?? [];
    list.push(o);
    byType.set(o.eventTypeId, list);
  }

  return (
    <div className="p-8">
      <PageHeader
        icon="🎉"
        title="Eventos"
        subtitle={`${types.length} tipo${types.length !== 1 ? "s" : ""} · ${occurrences.length} registro${occurrences.length !== 1 ? "s" : ""}`}
      />

      {types.length === 0 ? (
        <EmptyState
          icon="🎉"
          action={
            <form action={seedEventTypeDefaults}>
              <Button type="submit" variant="secondary">
                🌱 Cargar tipos básicos
              </Button>
            </form>
          }
        >
          Todavía no tienes tipos de evento. Carga los básicos para empezar.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(EVENT_TYPE_CATS).map(([catKey, cat]) => {
            const catTypes = types.filter((t) => t.category === catKey);
            if (catTypes.length === 0) return null;
            return (
              <details key={catKey} open>
                <summary className="flex cursor-pointer items-center gap-2 pb-2">
                  <span>{cat.icon}</span>
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-ink-dim">({catTypes.length})</span>
                  <span className="h-px flex-1 bg-line" />
                </summary>
                <div className="flex flex-col gap-2">
                  {catTypes.map((et) => (
                    <EventTypeCard key={et.id} eventType={et} icon={cat.icon} occurrences={byType.get(et.id) ?? []} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <form
        action={saveEventType}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Nombre">
          <Input name="name" required className="w-48" />
        </Labeled>
        <Labeled label="Categoría">
          <Select name="category" defaultValue="visita">
            {Object.entries(EVENT_TYPE_CATS).map(([key, c]) => (
              <option key={key} value={key}>
                {c.icon} {c.label}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Descripción">
          <Input name="description" className="w-64" />
        </Labeled>
        <Button type="submit">+ Nuevo tipo</Button>
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
    <details className="rounded-ui-lg border border-line bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{eventType.name}</div>
          {eventType.description && (
            <div className="truncate text-xs text-ink-dim">{eventType.description}</div>
          )}
        </div>
        <span className="text-xs text-ink-dim">
          {occurrences.length} {occurrences.length === 1 ? "vez" : "veces"}
        </span>
      </summary>

      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
        {occurrences.length === 0 ? (
          <p className="text-xs text-ink-muted">Sin registros todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {occurrences.map((o) => (
              <div key={o.id} className="rounded-ui bg-canvas p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                  <span>📅 {o.date}</span>
                  {o.people && <span>👤 {o.people}</span>}
                  {o.location && <span>📍 {o.location}</span>}
                  {o.cost != null && <span>💰 ${o.cost.toLocaleString("es-CO")}</span>}
                  {o.mood && <span>{MOOD_MAP[o.mood]}</span>}
                  <form action={deleteOccurrence} className="ml-auto">
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="text-ink-dim hover:text-danger">
                      Eliminar
                    </button>
                  </form>
                </div>
                {o.notes && <p className="mt-1 text-xs text-ink-dim">{o.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <form
          action={saveOccurrence}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
        >
          <input type="hidden" name="eventTypeId" value={eventType.id} />
          <Labeled label="Fecha">
            <Input type="date" name="date" defaultValue={todayISO()} required className="w-40" />
          </Labeled>
          <Labeled label="Con quién">
            <Input name="people" className="w-40" />
          </Labeled>
          <Labeled label="Lugar">
            <Input name="location" className="w-40" />
          </Labeled>
          <Labeled label="Costo">
            <Input type="number" step="0.01" name="cost" className="w-28" />
          </Labeled>
          <Labeled label="Cómo te fue">
            <Select name="mood" defaultValue="">
              <option value="">—</option>
              <option value="genial">😊 Genial</option>
              <option value="normal">😐 Normal</option>
              <option value="dificil">😔 Difícil</option>
            </Select>
          </Labeled>
          <Input name="notes" placeholder="Notas" className="w-full" />
          <Button type="submit" variant="secondary">
            + Registrar vez
          </Button>
        </form>

        <details>
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">Editar tipo</summary>
          <form
            action={saveEventType}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
          >
            <input type="hidden" name="id" value={eventType.id} />
            <Labeled label="Nombre">
              <Input name="name" defaultValue={eventType.name} required className="w-48" />
            </Labeled>
            <Labeled label="Categoría">
              <Select name="category" defaultValue={eventType.category}>
                {Object.entries(EVENT_TYPE_CATS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Descripción">
              <Input name="description" defaultValue={eventType.description ?? ""} className="w-64" />
            </Labeled>
            <Button type="submit">Guardar</Button>
            <Button type="submit" variant="danger" formAction={deleteEventType}>
              Eliminar tipo
            </Button>
          </form>
        </details>
      </div>
    </details>
  );
}
