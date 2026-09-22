import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { todayISO } from "@/lib/date/bogota";
import { Segmented, EmptyState, Button, cx, ListCard } from "@/components/ui";
import { toggleLogToday, incrementLog, decrementLog } from "./actions";

const FREQ_TABS: { id: string; label: string }[] = [
  { id: "diaria", label: "Diarios" },
  { id: "semanal", label: "Semanales" },
  { id: "mensual", label: "Mensuales" },
  { id: "unica", label: "Únicos" },
  { id: "recurrente", label: "Recurrentes" },
];

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

  const [habits, todayLogs] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(
        and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, freq)),
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

function HabitRow({
  h,
  freq,
  date,
  done,
  count,
}: {
  h: Habit;
  freq: string;
  date: string;
  done: boolean;
  count: number;
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
}: {
  h: Habit;
  freq: string;
  date: string;
  done: boolean;
  count: number;
}) {
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
