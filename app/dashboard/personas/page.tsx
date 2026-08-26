import { asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { people, importantDates } from "@/lib/db/schema/personas";
import { Field } from "@/components/ui/field";
import {
  createPersona,
  updatePersona,
  deletePersona,
  createImportantDate,
  deleteImportantDate,
} from "./actions";
import { todayISO, BOGOTA_OFFSET } from "@/lib/date/bogota";

type Person = InferSelectModel<typeof people>;
type ImportantDate = InferSelectModel<typeof importantDates>;

const REL_LABELS: Record<string, string> = {
  yo: "🪞 Yo",
  amigo: "👤 Amigo/a",
  familia: "👨‍👩‍👧 Familia",
  conocido: "🤝 Conocido/a",
  trabajo: "💼 Trabajo",
};

const FECHA_TIPOS: Record<string, string> = {
  cumpleanos: "🎂 Cumpleaños",
  especial: "⭐ Especial",
  aniversario: "💜 Aniversario",
  cita: "🏥 Cita",
  pago: "💰 Pago",
  evento: "🎉 Evento",
};

function daysUntil(day: number, month: number) {
  const [y] = todayISO().split("-").map(Number);
  const today = new Date(`${todayISO()}T00:00:00${BOGOTA_OFFSET}`);
  let next = new Date(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00${BOGOTA_OFFSET}`);
  if (next < today)
    next = new Date(`${y + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00${BOGOTA_OFFSET}`);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export default async function PersonasPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [allPeople, allDates] = await Promise.all([
    db
      .select()
      .from(people)
      .where(eq(people.userId, userId))
      .orderBy(asc(people.name)),
    db
      .select()
      .from(importantDates)
      .where(eq(importantDates.userId, userId)),
  ]);

  const birthdayByPersonId = new Map(
    allDates.filter((d) => d.personId).map((d) => [d.personId as string, d]),
  );
  const looseDates = allDates
    .filter((d) => !d.personId)
    .sort((a, b) => daysUntil(a.day, a.month) - daysUntil(b.day, b.month));

  return (
    <div className="space-y-8 p-8">
      <h1 className="font-display text-2xl text-text-primary">Personas</h1>

      <section>
        {allPeople.length === 0 ? (
          <p className="text-sm text-text-muted">No hay personas todavía.</p>
        ) : (
          <div className="space-y-2">
            {allPeople.map((p) => (
              <PersonRow key={p.id} person={p} birthday={birthdayByPersonId.get(p.id)} />
            ))}
          </div>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-text-muted">
            + Nueva persona
          </summary>
          <form
            action={createPersona}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
          >
            <Field label="Nombre">
              <input type="text" name="name" required className="input" />
            </Field>
            <Field label="Relación">
              <select name="relationship" defaultValue="amigo" className="input">
                {Object.entries(REL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cumpleaños (día)">
              <input type="number" name="bdayDay" min={1} max={31} className="input w-20" />
            </Field>
            <Field label="Mes">
              <input type="number" name="bdayMonth" min={1} max={12} className="input w-20" />
            </Field>
            <Field label="Notas">
              <input type="text" name="notes" className="input w-48" />
            </Field>
            <button
              type="submit"
              className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
            >
              Crear
            </button>
          </form>
        </details>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Fechas importantes
        </h2>
        {looseDates.length === 0 ? (
          <p className="text-sm text-text-muted">No hay fechas guardadas.</p>
        ) : (
          <div className="space-y-2">
            {looseDates.map((d) => {
              const days = daysUntil(d.day, d.month);
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2 text-sm"
                >
                  <span>{FECHA_TIPOS[d.type] ?? d.type}</span>
                  <span className="flex-1 text-text-primary">{d.name}</span>
                  <span className="text-xs text-text-muted">
                    {d.day}/{d.month}
                    {days <= 7 ? ` · ${days === 0 ? "¡Hoy!" : days === 1 ? "Mañana" : `${days} días`}` : ""}
                  </span>
                  <form action={deleteImportantDate}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="text-xs text-text-muted hover:text-red-400">
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <form
          action={createImportantDate}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Tipo">
            <select name="type" defaultValue="evento" className="input">
              {Object.entries(FECHA_TIPOS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Día">
            <input type="number" name="day" min={1} max={31} required className="input w-20" />
          </Field>
          <Field label="Mes">
            <input type="number" name="month" min={1} max={12} required className="input w-20" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            + Agregar
          </button>
        </form>
      </section>
    </div>
  );
}

function PersonRow({
  person,
  birthday,
}: {
  person: Person;
  birthday?: ImportantDate;
}) {
  const days = birthday ? daysUntil(birthday.day, birthday.month) : null;

  return (
    <div className="rounded-md border border-border bg-bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-mid/20 text-sm">
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">
            {person.name}
            {days !== null && days <= 7 && (
              <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold">
                {days === 0 ? "¡Hoy!" : days === 1 ? "Mañana" : `${days} días`}
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted">
            {REL_LABELS[person.relationship] ?? person.relationship}
            {birthday ? ` · 🎂 ${birthday.day}/${birthday.month}` : ""}
            {person.notes ? ` · ${person.notes}` : ""}
          </div>
        </div>
        <form action={deletePersona}>
          <input type="hidden" name="id" value={person.id} />
          <button type="submit" className="text-xs text-text-muted hover:text-red-400">
            Eliminar
          </button>
        </form>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-text-muted">Editar</summary>
        <form
          action={updatePersona}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="id" value={person.id} />
          <Field label="Nombre">
            <input type="text" name="name" defaultValue={person.name} required className="input" />
          </Field>
          <Field label="Relación">
            <select name="relationship" defaultValue={person.relationship} className="input">
              {Object.entries(REL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cumpleaños (día)">
            <input
              type="number"
              name="bdayDay"
              min={1}
              max={31}
              defaultValue={birthday?.day}
              className="input w-20"
            />
          </Field>
          <Field label="Mes">
            <input
              type="number"
              name="bdayMonth"
              min={1}
              max={12}
              defaultValue={birthday?.month}
              className="input w-20"
            />
          </Field>
          <Field label="Notas">
            <input type="text" name="notes" defaultValue={person.notes ?? ""} className="input w-48" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar
          </button>
        </form>
      </details>
    </div>
  );
}
