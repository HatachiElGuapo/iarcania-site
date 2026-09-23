import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs, activityQueueItems } from "@/lib/db/schema/habitos";
import { todayISO, weekdayMon0 } from "@/lib/date/bogota";
import { Segmented, EmptyState, Button, cx, ListCard } from "@/components/ui";
import { currentWorkItem } from "@/lib/habitos/work-queue";
import { listScriptOptions, type ScriptOption } from "@/lib/scripts-picker";
import { listBookOptions, type BookOption } from "@/lib/books-picker";
import { toggleLogToday, incrementLog, decrementLog } from "./actions";

const FREQ_TABS: { id: string; label: string }[] = [
  { id: "diaria", label: "Diarios" },
  { id: "semanal", label: "Semanales" },
  { id: "mensual", label: "Mensuales" },
  { id: "unica", label: "Únicos" },
  { id: "recurrente", label: "Recurrentes" },
  { id: "trabajo", label: "Trabajo" },
];

const CANAL_ICON: Record<string, string> = { iarcania: "🟣", voidstoic: "🔵" };
const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

export default async function HabitosPage({
  searchParams,
}: {
  searchParams: Promise<{ freq?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { freq: freqParam } = await searchParams;
  const freq = FREQ_TABS.find((f) => f.id === freqParam)?.id ?? "diaria";
  const date = todayISO();
  const todayWeekday = weekdayMon0(date);

  const isTrabajo = freq === "trabajo";
  const [habits, todayLogs] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.isActive, true),
          eq(activities.frequency, freq),
          ...(isTrabajo ? [sql`${activities.diasSemana} @> ARRAY[${todayWeekday}]::integer[]`] : []),
        ),
      )
      .orderBy(asc(activities.category), asc(activities.horaSugerida), asc(activities.name)),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date))),
  ]);

  const doneToday = new Set(todayLogs.map((l) => l.activityId));
  const doneCount = habits.filter((h) => doneToday.has(h.id)).length;
  const pct = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  // "Recurrentes" (ej. vicios) es contador, no booleano: cada fila de
  // activityLogs es una ocurrencia — el conteo del día es cuántas filas hay
  // para ese hábito, no si hay al menos una.
  const countByHabit = new Map<string, number>();
  for (const l of todayLogs) countByHabit.set(l.activityId, (countByHabit.get(l.activityId) ?? 0) + 1);

  // "Trabajo": el item actual de la lista de cada hábito se calcula por
  // cuántas veces se marcó CUMPLIDO en total (no por calendario) — ver
  // currentWorkItem. totalDoneByHabit cuenta TODO el historial, no solo hoy.
  let itemsByHabit = new Map<string, (typeof activityQueueItems.$inferSelect)[]>();
  let totalDoneByHabit = new Map<string, number>();
  let scriptOptions: ScriptOption[] = [];
  let bookOptions: BookOption[] = [];
  if (isTrabajo && habits.length > 0) {
    const habitIds = habits.map((h) => h.id);
    const [items, totals, scriptOpts, bookOpts] = await Promise.all([
      db
        .select()
        .from(activityQueueItems)
        .where(inArray(activityQueueItems.activityId, habitIds))
        .orderBy(asc(activityQueueItems.position)),
      db
        .select({ activityId: activityLogs.activityId, total: sql<number>`count(*)` })
        .from(activityLogs)
        .where(and(eq(activityLogs.userId, userId), inArray(activityLogs.activityId, habitIds)))
        .groupBy(activityLogs.activityId),
      listScriptOptions(userId),
      listBookOptions(userId),
    ]);
    for (const it of items) {
      const list = itemsByHabit.get(it.activityId) ?? [];
      list.push(it);
      itemsByHabit.set(it.activityId, list);
    }
    totalDoneByHabit = new Map(totals.map((t) => [t.activityId, Number(t.total)]));
    scriptOptions = scriptOpts;
    bookOptions = bookOpts;
  }

  const byCategory = new Map<string, typeof habits>();
  for (const h of habits) {
    const key = h.category ?? "Sin categoría";
    const list = byCategory.get(key) ?? [];
    list.push(h);
    byCategory.set(key, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          className="w-max"
          options={FREQ_TABS.map((f) => ({
            label: f.label,
            href: `/dashboard/habitos?freq=${f.id}`,
            active: freq === f.id,
          }))}
        />
      </div>

      {freq === "diaria" && habits.length > 0 && (
        <div className="rounded-ui-lg border border-line bg-surface p-3.5">
          <div className="mb-1 flex justify-between text-xs text-ink-muted">
            <span>Completados hoy</span>
            <span className="font-semibold text-accent-warm">
              {doneCount} / {habits.length} · {pct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent-warm" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {habits.length === 0 ? (
        <EmptyState icon="🔥">
          No tienes hábitos en esta frecuencia. Créalos desde la pestaña Gestión.
        </EmptyState>
      ) : (
        <>
          <div className="hidden flex-col gap-6 md:flex">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {category}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {list.map((h) => (
                    <HabitRow
                      key={h.id}
                      h={h}
                      freq={freq}
                      date={date}
                      done={doneToday.has(h.id)}
                      count={countByHabit.get(h.id) ?? 0}
                      workItem={
                        isTrabajo
                          ? currentWorkItem(itemsByHabit.get(h.id) ?? [], totalDoneByHabit.get(h.id) ?? 0)
                          : null
                      }
                      itemsTotal={itemsByHabit.get(h.id)?.length ?? 0}
                      totalDone={totalDoneByHabit.get(h.id) ?? 0}
                      scripts={scriptOptions}
                      books={bookOptions}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-5 md:hidden">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category} className="flex flex-col gap-2">
                <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {category}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {list.map((h) => (
                    <MobileHabitRow
                      key={h.id}
                      h={h}
                      freq={freq}
                      date={date}
                      done={doneToday.has(h.id)}
                      count={countByHabit.get(h.id) ?? 0}
                      workItem={
                        isTrabajo
                          ? currentWorkItem(itemsByHabit.get(h.id) ?? [], totalDoneByHabit.get(h.id) ?? 0)
                          : null
                      }
                      itemsTotal={itemsByHabit.get(h.id)?.length ?? 0}
                      totalDone={totalDoneByHabit.get(h.id) ?? 0}
                      scripts={scriptOptions}
                      books={bookOptions}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Habit = { id: string; name: string; horaSugerida: string | null };
type WorkItem = { id: string; text: string; notes: string | null; scriptId: string | null; bookId: string | null };

function WorkItemBody({
  h,
  workItem,
  itemsTotal,
  totalDone,
  scripts,
  books,
}: {
  h: Habit;
  workItem: WorkItem | null;
  itemsTotal: number;
  totalDone: number;
  scripts: ScriptOption[];
  books: BookOption[];
}) {
  const linkedScript = workItem?.scriptId ? scripts.find((s) => s.id === workItem.scriptId) : undefined;
  const linkedBook = workItem?.bookId ? books.find((b) => b.id === workItem.bookId) : undefined;
  const itemPosition = itemsTotal ? (totalDone % itemsTotal) + 1 : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-ink-muted">{h.name}</span>
        {itemPosition && (
          <span className="shrink-0 text-[10.5px] text-ink-dim">
            item {itemPosition}/{itemsTotal}
          </span>
        )}
      </div>
      {workItem ? (
        <>
          <div className="text-sm text-ink">{workItem.text}</div>
          {workItem.notes && <div className="mt-0.5 text-[11px] text-ink-dim">{workItem.notes}</div>}
          {(linkedScript || linkedBook) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {linkedScript && (
                <a
                  href={`/dashboard/guiones?canal=${linkedScript.canal}&open=${linkedScript.id}#script-${linkedScript.id}`}
                  className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10.5px] text-ink hover:underline"
                >
                  {CANAL_ICON[linkedScript.canal] ?? "🎬"} {linkedScript.title}
                </a>
              )}
              {linkedBook && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-muted">
                  📖 {linkedBook.title}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-ink-dim">Sin items en la lista — agrégalos desde el hábito.</div>
      )}
    </div>
  );
}

function HabitRow({
  h,
  freq,
  date,
  done,
  count,
  workItem = null,
  itemsTotal = 0,
  totalDone = 0,
  scripts = [],
  books = [],
}: {
  h: Habit;
  freq: string;
  date: string;
  done: boolean;
  count: number;
  workItem?: WorkItem | null;
  itemsTotal?: number;
  totalDone?: number;
  scripts?: ScriptOption[];
  books?: BookOption[];
}) {
  if (freq === "recurrente") {
    return (
      <div className="flex items-center gap-3 rounded-ui border border-line bg-surface px-3.5 py-2">
        <span className="flex-1 text-sm text-ink">{h.name}</span>
        <form action={decrementLog}>
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <Button type="submit" variant="secondary" size="sm" disabled={count === 0}>
            −
          </Button>
        </form>
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink">{count}</span>
        <form action={incrementLog}>
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <Button type="submit" variant="secondary" size="sm">
            +
          </Button>
        </form>
      </div>
    );
  }
  if (freq === "trabajo") {
    return (
      <div className="flex items-start gap-3 rounded-ui border border-line bg-surface px-3.5 py-2">
        <form action={toggleLogToday} className="pt-0.5">
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <button
            type="submit"
            aria-label="Marcar hecho hoy"
            className={cx(
              "flex h-4 w-4 items-center justify-center rounded-full border text-[9px] text-white",
              done ? "border-accent bg-accent" : "border-line-strong",
            )}
          >
            {done ? "✓" : ""}
          </button>
        </form>
        <WorkItemBody h={h} workItem={workItem} itemsTotal={itemsTotal} totalDone={totalDone} scripts={scripts} books={books} />
        {h.horaSugerida && <span className="shrink-0 text-xs tabular-nums text-ink-dim">{h.horaSugerida}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-ui border border-line bg-surface px-3.5 py-2">
      <form action={toggleLogToday}>
        <input type="hidden" name="activityId" value={h.id} />
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          aria-label="Marcar hecho hoy"
          className={cx(
            "flex h-4 w-4 items-center justify-center rounded-full border text-[9px] text-white",
            done ? "border-accent bg-accent" : "border-line-strong",
          )}
        >
          {done ? "✓" : ""}
        </button>
      </form>
      <span className={cx("flex-1 text-sm", done ? "text-ink-dim line-through" : "text-ink")}>{h.name}</span>
      {h.horaSugerida && <span className="text-xs tabular-nums text-ink-dim">{h.horaSugerida}</span>}
    </div>
  );
}

// Móvil · misma fila que <HabitRow>, con el shell <ListCard> (borde
// completo, 44px de objetivo táctil, texto a 15px) del resto de las
// pantallas móviles — mismos datos y mismas Server Actions.
function MobileHabitRow({
  h,
  freq,
  date,
  done,
  count,
  workItem = null,
  itemsTotal = 0,
  totalDone = 0,
  scripts = [],
  books = [],
}: {
  h: Habit;
  freq: string;
  date: string;
  done: boolean;
  count: number;
  workItem?: WorkItem | null;
  itemsTotal?: number;
  totalDone?: number;
  scripts?: ScriptOption[];
  books?: BookOption[];
}) {
  if (freq === "trabajo") {
    return (
      <ListCard>
        <form action={toggleLogToday}>
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <button
            type="submit"
            aria-label="Marcar hecho hoy"
            className={cx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] text-white",
              done ? "border-accent bg-accent" : "border-line-strong",
            )}
          >
            {done ? "✓" : ""}
          </button>
        </form>
        <WorkItemBody h={h} workItem={workItem} itemsTotal={itemsTotal} totalDone={totalDone} scripts={scripts} books={books} />
        {h.horaSugerida && <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">{h.horaSugerida}</span>}
      </ListCard>
    );
  }
  if (freq === "recurrente") {
    return (
      <ListCard>
        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{h.name}</span>
        <form action={decrementLog}>
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <button
            type="submit"
            disabled={count === 0}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim disabled:opacity-30"
          >
            −
          </button>
        </form>
        <span className="w-6 shrink-0 text-center text-[15px] font-semibold tabular-nums text-ink">{count}</span>
        <form action={incrementLog}>
          <input type="hidden" name="activityId" value={h.id} />
          <input type="hidden" name="date" value={date} />
          <button
            type="submit"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim"
          >
            +
          </button>
        </form>
      </ListCard>
    );
  }
  return (
    <form action={toggleLogToday}>
      <input type="hidden" name="activityId" value={h.id} />
      <input type="hidden" name="date" value={date} />
      <button type="submit" className="contents">
        <ListCard>
          <span
            className={cx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] text-white",
              done ? "border-accent bg-accent" : "border-line-strong",
            )}
          >
            {done ? "✓" : ""}
          </span>
          <span className={cx("min-w-0 flex-1 truncate text-[15px]", done ? "text-ink-dim line-through" : "text-ink")}>
            {h.name}
          </span>
          {h.horaSugerida && (
            <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">{h.horaSugerida}</span>
          )}
        </ListCard>
      </button>
    </form>
  );
}
