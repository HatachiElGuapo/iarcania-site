import { and, asc, eq, gte, lte, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { choreTypes, choreLogs } from "@/lib/db/schema/hogar";
import {
  PageHeader,
  Card,
  Table,
  TableHead,
  TableRow,
  Button,
  Input,
} from "@/components/ui";
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
    db.select().from(choreLogs).where(and(eq(choreLogs.userId, userId), eq(choreLogs.date, date))),
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

  const doneToday = new Set(todayLogs.filter((l) => l.doneBy && !l.notes).map((l) => l.choreTypeId)).size;
  const gridCols = `minmax(0,1fr) repeat(${days.length}, 1fr)`;

  return (
    <div className="p-8">
      <PageHeader
        icon="🏠"
        title="Hogar"
        subtitle={`${types.length} quehaceres · ${doneToday} con actividad hoy`}
      />

      <div className="flex flex-col gap-3">
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

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nuevo quehacer</summary>
        <form
          action={createChoreType}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Input name="name" required placeholder="Nombre" aria-label="Nombre" className="w-44" />
          <Input name="icon" maxLength={2} placeholder="🧽" aria-label="Ícono" className="w-16" />
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input type="checkbox" name="allowMultiple" />
            Permite varias veces al día
          </label>
          <Button type="submit" variant="secondary">
            Crear
          </Button>
        </form>
      </details>

      <section className="mt-8">
        <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Últimos 7 días
        </h2>
        <Table>
          <TableHead cols={gridCols}>
            <span>Quehacer</span>
            {days.map((d) => (
              <span key={d.date} className="text-center">
                {d.label}
              </span>
            ))}
          </TableHead>
          {types.map((chore) => (
            <TableRow key={chore.id} cols={gridCols}>
              <span className="truncate text-ink-muted">
                {chore.icon} {chore.name}
              </span>
              {days.map((d) => {
                const logs = weekByTypeDate.get(`${chore.id}|${d.date}`) ?? [];
                const names = [...new Set(logs.map((l) => l.doneBy).filter(Boolean))];
                return (
                  <span key={d.date} className="text-center text-[11px] text-ink-dim">
                    {names.length > 0 ? names.join("+") : "·"}
                  </span>
                );
              })}
            </TableRow>
          ))}
        </Table>
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
    <div className="rounded-ui-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">{chore.icon}</span>
        <span className="flex-1 text-sm font-semibold text-ink">{chore.name}</span>
      </div>

      {occurrences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {occurrences.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 rounded-ui bg-canvas px-2 py-1 text-xs text-ink"
            >
              <span>{o.doneBy ?? "—"}</span>
              <form action={updateChoreLog} className="flex items-center gap-1">
                <input type="hidden" name="id" value={o.id} />
                <input
                  type="time"
                  name="doneAt"
                  defaultValue={o.doneAt ?? ""}
                  className="w-20 bg-transparent text-ink-muted outline-none"
                />
                <button type="submit" className="text-ink-muted hover:text-ink">
                  ✓
                </button>
              </form>
              <form action={deleteChoreLog}>
                <input type="hidden" name="id" value={o.id} />
                <button type="submit" className="text-ink-muted hover:text-danger">
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
            <div key={n.id} className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="flex-1">📝 {n.notes}</span>
              <form action={deleteChoreLog}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="hover:text-danger">
                  Eliminar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        {canLogMore && (
          <form action={logChoreDone} className="flex items-end gap-2">
            <input type="hidden" name="choreTypeId" value={chore.id} />
            <input type="hidden" name="date" value={date} />
            <Input name="doneBy" placeholder="Quién" aria-label="Quién" className="w-28" />
            <Button type="submit" variant="secondary" className="border-success/40 text-success hover:border-success">
              ✓ Marcar hecho
            </Button>
          </form>
        )}
        <form action={addChoreNote} className="flex items-end gap-2">
          <input type="hidden" name="choreTypeId" value={chore.id} />
          <input type="hidden" name="date" value={date} />
          <Input name="notes" placeholder="ej: arroz con pollo" aria-label="Nota" className="w-40" />
          <Button type="submit" variant="secondary">
            📝
          </Button>
        </form>
      </div>
    </div>
  );
}
