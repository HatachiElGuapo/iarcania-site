import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { todayISO } from "@/lib/date/bogota";
import { Segmented, EmptyState, cx } from "@/components/ui";
import { toggleLogToday } from "./actions";

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

  const byCategory = new Map<string, typeof habits>();
  for (const h of habits) {
    const key = h.category ?? "Sin categoría";
    const list = byCategory.get(key) ?? [];
    list.push(h);
    byCategory.set(key, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <Segmented
        options={FREQ_TABS.map((f) => ({
          label: f.label,
          href: `/dashboard/habitos?freq=${f.id}`,
          active: freq === f.id,
        }))}
      />

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
        <div className="flex flex-col gap-6">
          {[...byCategory.entries()].map(([category, list]) => {
            return (
              <div key={category}>
                <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {category}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {list.map((h) => {
                    const done = doneToday.has(h.id);
                    return (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 rounded-ui border border-line bg-surface px-3.5 py-2"
                      >
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
                        <span
                          className={cx("flex-1 text-sm", done ? "text-ink-dim line-through" : "text-ink")}
                        >
                          {h.name}
                        </span>
                        {h.horaSugerida && (
                          <span className="text-xs tabular-nums text-ink-dim">{h.horaSugerida}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
