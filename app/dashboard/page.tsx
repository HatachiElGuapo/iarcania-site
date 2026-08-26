import { and, asc, eq, lt, ne, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
import { todayISO } from "@/lib/date/bogota";
import { toggleTaskStatus } from "./actividades/actions";
import { toggleLogToday } from "./habitos/actions";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-red-400",
  media: "text-gold",
  baja: "text-text-muted",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Home del dashboard — os.html combinaba esto con una vista muy personalizada
// (rutina 20/20/20, ~30 hábitos hardcodeados por ID, modo emergencia) que
// NOTES.md ya documentó como deliberadamente fuera de alcance al migrar
// Hábitos. Aquí es un resumen real sobre las tablas migradas (tasks,
// activities/activity_logs, appointments) — foco del día, hábitos
// pendientes, tareas de hoy y un vistazo rápido a lo que necesita atención.
export default async function RutinasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();
  const now = new Date();

  const [todayTasks, dailyHabits, todayLogs, overdueTasks, nextCita] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, today), ne(tasks.status, "archivada")))
      .orderBy(asc(tasks.timeDue)),
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, "diaria")))
      .orderBy(asc(activities.horaSugerida), asc(activities.name)),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, today))),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), lt(tasks.dueDate, today), eq(tasks.status, "pendiente"))),
    db
      .select()
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.status, "pendiente"), gte(appointments.datetime, now)))
      .orderBy(asc(appointments.datetime))
      .limit(1),
  ]);

  const doneHabitIds = new Set(todayLogs.map((l) => l.activityId));
  const habitsDone = dailyHabits.filter((h) => doneHabitIds.has(h.id)).length;
  const tasksDone = todayTasks.filter((t) => t.status === "completada").length;
  const pending = dailyHabits.length - habitsDone + (todayTasks.length - tasksDone);
  const done = habitsDone + tasksDone;

  const dateLong = capitalize(
    now.toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );

  return (
    <div className="space-y-6 p-8">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-0.5 text-[26px] text-text-primary">
            Buen día{session!.user?.name ? `, ${session!.user.name}` : ""}
          </h1>
          <p className="text-xs text-text-dim">{dateLong}</p>
        </div>
        <div className="flex gap-2.5">
          <div className="min-w-16 rounded-md border border-border bg-bg-card px-4 py-2.5 text-center">
            <div className="stat-num">{pending}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">pendientes</div>
          </div>
          <div className="min-w-16 rounded-md border border-border bg-bg-card px-4 py-2.5 text-center">
            <div className="stat-num text-green-400">{done}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">completadas</div>
          </div>
        </div>
      </div>

      {(overdueTasks.length > 0 || nextCita.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueTasks.length > 0 && (
            <a
              href="/dashboard/actividades?tiempo=vencidas"
              className="rounded-md border border-red-500/25 bg-red-500/[0.06] px-4 py-2 text-xs text-red-400 transition-colors hover:border-red-500/50"
            >
              ⚠ {overdueTasks.length} tarea{overdueTasks.length !== 1 ? "s" : ""} vencida
              {overdueTasks.length !== 1 ? "s" : ""}
            </a>
          )}
          {nextCita.length > 0 && (
            <a
              href="/dashboard/citas"
              className="rounded-md border border-gold/25 bg-gold/[0.06] px-4 py-2 text-xs text-gold transition-colors hover:border-gold/50"
            >
              🏥 Próxima cita: {nextCita[0].title} —{" "}
              {nextCita[0].datetime.toLocaleString("es-CO", {
                timeZone: "America/Bogota",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </a>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-glow p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">✅ Tareas de hoy</h2>
            <a href="/dashboard/actividades" className="text-xs text-text-muted hover:text-gold">
              Ver todas →
            </a>
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-xs text-text-muted">Sin tareas para hoy.</p>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <form action={toggleTaskStatus}>
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      type="hidden"
                      name="nextStatus"
                      value={t.status === "completada" ? "pendiente" : "completada"}
                    />
                    <button
                      type="submit"
                      className={`h-4 w-4 shrink-0 rounded border ${t.status === "completada" ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                      aria-label="Cambiar estado"
                    />
                  </form>
                  <span
                    className={`flex-1 text-sm ${t.status === "completada" ? "text-text-dim line-through" : "text-text-primary"}`}
                  >
                    {t.title}
                  </span>
                  {t.timeDue && <span className="text-xs text-text-muted">{t.timeDue}</span>}
                  <span className={`text-xs font-semibold ${PRIORITY_COLOR[t.priority]}`}>●</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-glow p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">🔥 Hábitos de hoy</h2>
            <a href="/dashboard/habitos" className="text-xs text-text-muted hover:text-gold">
              Ver todos →
            </a>
          </div>
          {dailyHabits.length === 0 ? (
            <p className="text-xs text-text-muted">Sin hábitos diarios activos.</p>
          ) : (
            <div className="space-y-2">
              {dailyHabits.map((h) => {
                const isDone = doneHabitIds.has(h.id);
                return (
                  <div key={h.id} className="flex items-center gap-3">
                    <form action={toggleLogToday}>
                      <input type="hidden" name="activityId" value={h.id} />
                      <input type="hidden" name="date" value={today} />
                      <button
                        type="submit"
                        className={`h-4 w-4 shrink-0 rounded border ${isDone ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                        aria-label="Marcar hecho hoy"
                      />
                    </form>
                    <span
                      className={`flex-1 text-sm ${isDone ? "text-text-dim line-through" : "text-text-primary"}`}
                    >
                      {h.name}
                    </span>
                    {h.horaSugerida && <span className="text-xs text-text-muted">{h.horaSugerida}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
