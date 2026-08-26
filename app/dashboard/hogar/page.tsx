import { and, asc, eq, gte, lte, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { choreTypes, choreLogs } from "@/lib/db/schema/hogar";
import { Field } from "@/components/ui/field";
import {
  createChoreType,
  logChoreDone,
  updateChoreLog,
  deleteChoreLog,
  addChoreNote,
} from "./actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";

type ChoreType = InferSelectModel<typeof choreTypes>;
type ChoreLog = InferSelectModel<typeof choreLogs>;

const DEFAULT_CHORES = [
  { name: "Cocinar", icon: "🍳", allowMultiple: true, sortOrder: 0 },
  { name: "Loza", icon: "🍽️", allowMultiple: true, sortOrder: 1 },
  { name: "Barrer", icon: "🧹", allowMultiple: true, sortOrder: 2 },
  { name: "Lavar ropa", icon: "🧺", allowMultiple: false, sortOrder: 3 },
  { name: "Colgar ropa", icon: "👕", allowMultiple: false, sortOrder: 4 },
  { name: "Basura", icon: "🗑️", allowMultiple: false, sortOrder: 5 },
  { name: "Baño", icon: "🧽", allowMultiple: false, sortOrder: 6 },
];

function last7Days() {
  const today = todayISO();
  const days: { date: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDaysISO(today, -i);
    const label =
      i === 0
        ? "Hoy"
        : new Date(`${date}T12:00:00-05:00`)
            .toLocaleDateString("es-CO", { weekday: "short", timeZone: "America/Bogota" })
            .replace(".", "");
    days.push({ date, label });
  }
  return days;
}

export default async function HogarPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();

  let types = await db
    .select()
    .from(choreTypes)
    .where(eq(choreTypes.userId, userId))
    .orderBy(asc(choreTypes.sortOrder));

  if (types.length === 0) {
    types = await db
      .insert(choreTypes)
      .values(DEFAULT_CHORES.map((c) => ({ ...c, userId })))
      .returning();
  }

  const days = last7Days();

  const [todayLogs, weekLogs] = await Promise.all([
    db
      .select()
      .from(choreLogs)
      .where(and(eq(choreLogs.userId, userId), eq(choreLogs.date, date))),
    db
      .select()
      .from(choreLogs)
      .where(
        and(
          eq(choreLogs.userId, userId),
          gte(choreLogs.date, days[0].date),
          lte(choreLogs.date, days[days.length - 1].date),
        ),
      ),
  ]);

  const todayByType = new Map<string, { occ: ChoreLog[]; notes: ChoreLog[] }>();
  for (const log of todayLogs) {
    const bucket = todayByType.get(log.choreTypeId) ?? { occ: [], notes: [] };
    (log.notes ? bucket.notes : bucket.occ).push(log);
    todayByType.set(log.choreTypeId, bucket);
  }

  const weekByTypeDate = new Map<string, ChoreLog[]>();
  for (const log of weekLogs) {
    if (log.notes || !log.doneBy) continue;
    const key = `${log.choreTypeId}|${log.date}`;
    const list = weekByTypeDate.get(key) ?? [];
    list.push(log);
    weekByTypeDate.set(key, list);
  }

  return (
    <div className="space-y-8 p-8">
      <h1 className="font-display text-2xl text-text-primary">Hogar</h1>

      <div className="space-y-3">
        {types.map((chore) => (
          <ChoreCard
            key={chore.id}
            chore={chore}
            date={date}
            occurrences={todayByType.get(chore.id)?.occ ?? []}
            notes={todayByType.get(chore.id)?.notes ?? []}
          />
        ))}
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nuevo quehacer</summary>
        <form
          action={createChoreType}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Ícono (emoji)">
            <input type="text" name="icon" maxLength={2} className="input w-16" />
          </Field>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" name="allowMultiple" />
            Permite varias veces al día
          </label>
          <button
            type="submit"
            className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            Crear
          </button>
        </form>
      </details>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Últimos 7 días
        </h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium"></th>
                {days.map((d) => (
                  <th key={d.date} className="px-2 py-2 text-center font-medium">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((chore) => (
                <tr key={chore.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-text-dim">
                    {chore.icon} {chore.name}
                  </td>
                  {days.map((d) => {
                    const logs = weekByTypeDate.get(`${chore.id}|${d.date}`) ?? [];
                    const names = [...new Set(logs.map((l) => l.doneBy).filter(Boolean))];
                    return (
                      <td key={d.date} className="px-2 py-2 text-center text-xs text-text-muted">
                        {names.length > 0 ? names.join("+") : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChoreCard({
  chore,
  date,
  occurrences,
  notes,
}: {
  chore: ChoreType;
  date: string;
  occurrences: ChoreLog[];
  notes: ChoreLog[];
}) {
  const canLogMore = chore.allowMultiple || occurrences.length === 0;

  return (
    <div className="rounded-md border border-border bg-bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">{chore.icon}</span>
        <span className="flex-1 text-sm font-semibold text-text-primary">{chore.name}</span>
      </div>

      {occurrences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {occurrences.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 rounded-md bg-bg-deep/40 px-2 py-1 text-xs text-text-primary"
            >
              <span>{o.doneBy ?? "—"}</span>
              <form action={updateChoreLog} className="flex items-center gap-1">
                <input type="hidden" name="id" value={o.id} />
                <input
                  type="time"
                  name="doneAt"
                  defaultValue={o.doneAt ?? ""}
                  className="w-20 bg-transparent text-text-muted"
                />
                <button type="submit" className="text-text-muted hover:text-text-primary">
                  ✓
                </button>
              </form>
              <form action={deleteChoreLog}>
                <input type="hidden" name="id" value={o.id} />
                <button type="submit" className="text-text-muted hover:text-red-400">
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-2 space-y-1">
          {notes.map((n) => (
            <div key={n.id} className="flex items-center gap-2 text-xs text-text-muted">
              <span className="flex-1">📝 {n.notes}</span>
              <form action={deleteChoreLog}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="hover:text-red-400">
                  Eliminar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
        {canLogMore && (
          <form action={logChoreDone} className="flex items-end gap-2">
            <input type="hidden" name="choreTypeId" value={chore.id} />
            <input type="hidden" name="date" value={date} />
            <Field label="Quién">
              <input type="text" name="doneBy" placeholder="Nombre" className="input w-28" />
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-green-500/40 px-3 py-1.5 text-xs text-green-400 hover:border-green-400"
            >
              ✓ Marcar hecho
            </button>
          </form>
        )}
        <form action={addChoreNote} className="flex items-end gap-2">
          <input type="hidden" name="choreTypeId" value={chore.id} />
          <input type="hidden" name="date" value={date} />
          <Field label="Nota">
            <input type="text" name="notes" placeholder="ej: arroz con pollo" className="input w-40" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            📝
          </button>
        </form>
      </div>
    </div>
  );
}
