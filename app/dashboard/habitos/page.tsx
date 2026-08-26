import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { todayISO } from "@/lib/date/bogota";
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
        and(
          eq(activities.userId, userId),
          eq(activities.isActive, true),
          eq(activities.frequency, freq),
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

  const byCategory = new Map<string, typeof habits>();
  for (const h of habits) {
    const key = h.category ?? "Sin categoría";
    const list = byCategory.get(key) ?? [];
    list.push(h);
    byCategory.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-sm">
        {FREQ_TABS.map((f) => (
          <a
            key={f.id}
            href={`/dashboard/habitos?freq=${f.id}`}
            className={`rounded-sm px-3 py-1.5 ${
              freq === f.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {freq === "diaria" && habits.length > 0 && (
        <div className="rounded-md border border-border bg-bg-card p-3">
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>Completados hoy</span>
            <span>
              {doneCount}/{habits.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-cta"
              style={{ width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {habits.length === 0 ? (
        <p className="text-sm text-text-muted">Sin hábitos en esta frecuencia.</p>
      ) : (
        <div className="space-y-6">
          {[...byCategory.entries()].map(([category, list]) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {category}
              </h2>
              <div className="space-y-2">
                {list.map((h) => {
                  const done = doneToday.has(h.id);
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2"
                    >
                      <form action={toggleLogToday}>
                        <input type="hidden" name="activityId" value={h.id} />
                        <input type="hidden" name="date" value={date} />
                        <button
                          type="submit"
                          className={`h-4 w-4 rounded border ${done ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                          aria-label="Marcar hecho hoy"
                        />
                      </form>
                      <span
                        className={`flex-1 text-sm ${done ? "text-text-dim line-through" : "text-text-primary"}`}
                      >
                        {h.name}
                      </span>
                      {h.horaSugerida && (
                        <span className="text-xs text-text-muted">{h.horaSugerida}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
