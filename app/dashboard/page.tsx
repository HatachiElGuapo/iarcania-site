import { and, asc, eq, lt, ne, gte, lte, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
import { Field } from "@/components/ui/field";
import { CATS } from "@/lib/constants/cats";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { ToggleRow } from "@/components/app/optimistic-toggle-row";
import { toggleTaskStatus, createTask } from "./actividades/actions";
import { toggleLogToday, createActivity } from "./habitos/actions";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-red-400",
  media: "text-gold",
  baja: "text-text-muted",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDayShort(iso: string) {
  return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Home del dashboard — os.html combinaba esto con una vista muy personalizada
// (rutina 20/20/20, ~30 hábitos hardcodeados por ID, modo emergencia) que
// NOTES.md ya documentó como deliberadamente fuera de alcance al migrar
// Hábitos. Aquí es un resumen real sobre las tablas migradas (tasks,
// activities/activity_logs, appointments) — foco del día, hábitos
// pendientes, tareas de hoy, próximos 7 días, y un vistazo rápido a lo que
// necesita atención. Navegador de día (‹ fecha ›) restaurado del original
// (navegarDia) — no puede ir al futuro, igual que allá.
export default async function RutinasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();
  const { date: dateParam } = await searchParams;
  const date = dateParam && dateParam <= today ? dateParam : today;
  const isToday = date === today;
  const now = new Date();
  const weekEnd = addDaysISO(date, 7);

  const [dayTasks, dailyHabits, dayLogs, overdueTasks, nextCita, upcomingTasks] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, date), ne(tasks.status, "archivada")))
      .orderBy(asc(tasks.timeDue)),
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, "diaria")))
      .orderBy(asc(activities.horaSugerida), asc(activities.name)),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date))),
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
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          gt(tasks.dueDate, date),
          lte(tasks.dueDate, weekEnd),
          ne(tasks.status, "completada"),
          ne(tasks.status, "archivada"),
        ),
      )
      .orderBy(asc(tasks.dueDate), asc(tasks.timeDue)),
  ]);

  const doneHabitIds = new Set(dayLogs.map((l) => l.activityId));
  const habitsDone = dailyHabits.filter((h) => doneHabitIds.has(h.id)).length;
  const tasksDone = dayTasks.filter((t) => t.status === "completada").length;
  const pending = dailyHabits.length - habitsDone + (dayTasks.length - tasksDone);
  const done = habitsDone + tasksDone;

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );

  return (
    <div className="space-y-5 p-8">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-0.5 text-[26px] text-text-primary">
            Buen día{session!.user?.name ? `, ${session!.user.name}` : ""}
          </h1>
          <p className="text-xs text-text-dim">{dateLong}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-bg-card px-1 py-0.5">
            <a
              href={`/dashboard?date=${addDaysISO(date, -1)}`}
              className="px-1.5 text-base leading-none text-text-muted hover:text-text-primary"
            >
              ‹
            </a>
            <span className="min-w-[60px] text-center text-xs text-text-dim">
              {isToday ? "Hoy" : fmtDayShort(date)}
            </span>
            <a
              href={isToday ? undefined : `/dashboard?date=${addDaysISO(date, 1)}`}
              className={`px-1.5 text-base leading-none ${isToday ? "pointer-events-none text-text-muted/30" : "text-text-muted hover:text-text-primary"}`}
            >
              ›
            </a>
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
            <h2 className="text-sm font-semibold text-text-primary">
              ✅ Tareas {isToday ? "de hoy" : `del ${fmtDayShort(date)}`}
            </h2>
            <a href="/dashboard/actividades" className="text-xs text-text-muted hover:text-gold">
              Ver todas →
            </a>
          </div>
          {dayTasks.length === 0 ? (
            <p className="mb-2 text-xs text-text-muted">Sin tareas para este día.</p>
          ) : (
            <div className="mb-1">
              {dayTasks.map((t) => {
                const cat = t.category ? CATS[t.category] : null;
                const catColor = cat?.color ?? "#333333";
                return (
                  <ToggleRow
                    key={t.id}
                    label={t.title}
                    initialDone={t.status === "completada"}
                    action={toggleTaskStatus}
                    fieldsOn={{ id: t.id, nextStatus: "completada" }}
                    fieldsOff={{ id: t.id, nextStatus: "pendiente" }}
                    borderColor={catColor}
                    meta={
                      <>
                        {t.timeDue && <span className="text-[11px] text-text-muted">{t.timeDue}</span>}
                        {cat && (
                          <span className="text-[10px]" style={{ color: catColor }}>
                            {cat.label}
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${PRIORITY_COLOR[t.priority]}`}>●</span>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-muted hover:text-gold">+ Tarea rápida</summary>
            <form action={createTask} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="dueDate" value={date} />
              <Field label="Título">
                <input type="text" name="title" required className="input w-48" />
              </Field>
              <Field label="Prioridad">
                <select name="priority" defaultValue="media" className="input">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </Field>
              <Field label="Hora">
                <input type="time" name="timeDue" className="input" />
              </Field>
              <button type="submit" className="btn-primary">
                + Agregar
              </button>
            </form>
          </details>
        </section>

        <section className="card-glow p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">🔥 Hábitos {isToday ? "de hoy" : `del ${fmtDayShort(date)}`}</h2>
            <a href="/dashboard/habitos" className="text-xs text-text-muted hover:text-gold">
              Ver todos →
            </a>
          </div>
          {dailyHabits.length === 0 ? (
            <p className="mb-2 text-xs text-text-muted">Sin hábitos diarios activos.</p>
          ) : (
            <div className="mb-1">
              {dailyHabits.map((h) => (
                <ToggleRow
                  key={h.id}
                  label={h.name}
                  initialDone={doneHabitIds.has(h.id)}
                  action={toggleLogToday}
                  fieldsOn={{ activityId: h.id, date }}
                  fieldsOff={{ activityId: h.id, date }}
                  meta={h.horaSugerida ? <span className="text-[11px] text-text-muted">{h.horaSugerida}</span> : undefined}
                />
              ))}
            </div>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-muted hover:text-gold">+ Hábito rápido</summary>
            <form action={createActivity} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="frequency" value="diaria" />
              <Field label="Nombre">
                <input type="text" name="name" required className="input w-48" />
              </Field>
              <Field label="Hora sugerida">
                <input type="time" name="horaSugerida" className="input" />
              </Field>
              <button type="submit" className="btn-primary">
                + Agregar
              </button>
            </form>
          </details>
        </section>
      </div>

      {upcomingTasks.length > 0 && (
        <section className="card-glow p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">📅 Próximos 7 días</h2>
            <a href="/dashboard/actividades?tiempo=semana" className="text-xs text-text-muted hover:text-gold">
              Ver todas →
            </a>
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {upcomingTasks.map((t) => {
              const cat = t.category ? CATS[t.category] : null;
              return (
                <div key={t.id} className="flex min-w-0 items-center gap-2.5 py-1 text-sm">
                  <span className="w-24 shrink-0 whitespace-nowrap text-[11px] text-text-muted">
                    {fmtDayShort(t.dueDate!)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">{t.title}</span>
                  {cat && (
                    <span className="text-[10px]" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${PRIORITY_COLOR[t.priority]}`}>●</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
