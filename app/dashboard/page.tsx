import { and, asc, eq, lt, ne, gte, lte, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
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

const APPT_ICON: Record<string, string> = {
  medica: "🏥",
  odontologica: "🏥",
  reunion: "🎉",
  otro: "📌",
};

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "pendientes", label: "Pendientes" },
  { id: "alta", label: "Alta" },
] as const;

const HABIT_LOOKBACK_DAYS = 90;

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

// Racha actual: días consecutivos con log terminando en `from` — si `from`
// (hoy) todavía no tiene log, la racha previa sigue contando desde ayer
// (no se rompe hasta que cierre el día sin marcarlo).
function computeStreak(dates: Set<string> | undefined, from: string): number {
  if (!dates || dates.size === 0) return 0;
  let d = dates.has(from) ? from : addDaysISO(from, -1);
  let streak = 0;
  while (dates.has(d)) {
    streak++;
    d = addDaysISO(d, -1);
  }
  return streak;
}

function weekCells(dates: Set<string> | undefined, upTo: string) {
  const cells: { done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    cells.push({ done: dates?.has(addDaysISO(upTo, -i)) ?? false });
  }
  return cells;
}

function blockOf(t: { timeDue: string | null }): "mañana" | "tarde" | "sin" {
  if (!t.timeDue) return "sin";
  return t.timeDue < "12:00" ? "mañana" : "tarde";
}

const BLOCK_LABELS = { mañana: "Mañana", tarde: "Tarde", sin: "Sin hora" } as const;
const BLOCK_ORDER = ["mañana", "tarde", "sin"] as const;

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
  searchParams: Promise<{ date?: string; filtro?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();
  const { date: dateParam, filtro: filtroParam } = await searchParams;
  const date = dateParam && dateParam <= today ? dateParam : today;
  const isToday = date === today;
  const now = new Date();
  const weekEnd = addDaysISO(date, 7);
  const lookbackStart = addDaysISO(date, -HABIT_LOOKBACK_DAYS);
  const filtro = FILTROS.some((f) => f.id === filtroParam) ? (filtroParam as string) : "todas";

  const [dayTasks, dailyHabits, dayLogs, habitLogs, overdueTasks, upcomingAppointments, upcomingTasks] =
    await Promise.all([
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
        .select({ activityId: activityLogs.activityId, date: activityLogs.date })
        .from(activityLogs)
        .where(and(eq(activityLogs.userId, userId), gte(activityLogs.date, lookbackStart), lte(activityLogs.date, date))),
      db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), lt(tasks.dueDate, today), eq(tasks.status, "pendiente"))),
      db
        .select()
        .from(appointments)
        .where(and(eq(appointments.userId, userId), eq(appointments.status, "pendiente"), gte(appointments.datetime, now)))
        .orderBy(asc(appointments.datetime))
        .limit(2),
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
  const totalToday = dayTasks.length + dailyHabits.length;
  const doneToday = tasksDone + habitsDone;
  const pendingToday = totalToday - doneToday;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  const logsByHabit = new Map<string, Set<string>>();
  for (const l of habitLogs) {
    if (!logsByHabit.has(l.activityId)) logsByHabit.set(l.activityId, new Set());
    logsByHabit.get(l.activityId)!.add(l.date);
  }
  const habitsView = dailyHabits.map((h) => {
    const dates = logsByHabit.get(h.id);
    return {
      id: h.id,
      name: h.name,
      horaSugerida: h.horaSugerida,
      done: doneHabitIds.has(h.id),
      streak: computeStreak(dates, date),
      week: weekCells(dates, date),
    };
  });
  const bestStreak = habitsView.length ? Math.max(...habitsView.map((h) => h.streak)) : 0;

  const stats: { value: number; label: string; sub: string; color: string }[] = [
    { value: pendingToday, label: "pendientes", sub: "hoy", color: "text-text-primary" },
    { value: doneToday, label: "completadas", sub: `de ${totalToday}`, color: "text-green-400" },
    { value: overdueTasks.length, label: "vencidas", sub: "", color: "text-red-400" },
    { value: bestStreak, label: "mejor racha", sub: "días", color: "text-gold" },
  ];

  const filteredDayTasks = dayTasks.filter((t) =>
    filtro === "pendientes" ? t.status !== "completada" : filtro === "alta" ? t.priority === "alta" : true,
  );
  const blocks = BLOCK_ORDER.map((k) => ({
    key: k,
    label: BLOCK_LABELS[k],
    items: filteredDayTasks.filter((t) => blockOf(t) === k),
  })).filter((b) => b.items.length > 0);

  const catCounts: Record<string, number> = {};
  for (const t of dayTasks) if (t.category) catCounts[t.category] = (catCounts[t.category] ?? 0) + 1;
  const maxCatCount = Math.max(1, ...Object.values(catCounts));
  const categoryLegend = Object.entries(catCounts)
    .map(([key, count]) => ({
      key,
      label: CATS[key]?.label ?? key,
      color: CATS[key]?.color ?? "#8a8070",
      count,
      pct: Math.round((count / maxCatCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );
  const nowTime = now.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });

  const qsHome = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (filtro !== "todas") params.set("filtro", filtro);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  };

  return (
    <div className="flex flex-col gap-4 p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-0.5 text-[26px] text-text-primary">
            Buen día{session!.user?.name ? `, ${session!.user.name}` : ""}
          </h1>
          <p className="text-xs text-text-dim">
            {dateLong} · {nowTime} · Bogotá
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-bg-card">
            <a
              href={`/dashboard?date=${addDaysISO(date, -1)}`}
              className="flex items-center border-r border-border px-2.5 text-sm leading-none text-text-muted hover:text-text-primary"
            >
              ‹
            </a>
            <span className={`px-3.5 py-1.5 text-xs font-medium ${isToday ? "bg-bg-card-2 text-gold" : "text-text-dim"}`}>
              {isToday ? "Hoy" : fmtDayShort(date)}
            </span>
            <a
              href={isToday ? undefined : `/dashboard?date=${addDaysISO(date, 1)}`}
              className={`flex items-center border-l border-border px-2.5 text-sm leading-none ${
                isToday ? "pointer-events-none text-text-muted/30" : "text-text-muted hover:text-text-primary"
              }`}
            >
              ›
            </a>
          </div>
          <a href={`/dashboard/agenda?date=${date}`} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text-primary">
            Agenda del día
          </a>
          <a href="#nueva-tarea" className="btn-primary">
            + Nueva tarea
          </a>
        </div>
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(4, 1fr) 1.6fr" }}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-bg-card px-3.5 py-3">
            <div className="flex items-baseline gap-1.5">
              <span className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</span>
              {s.sub && <span className="text-[11px] text-text-dim">{s.sub}</span>}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">{s.label}</div>
          </div>
        ))}
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-gold/20 bg-[#100E07] px-3.5 py-3">
          <div className="flex justify-between text-[11px] text-text-muted">
            <span>Progreso del día</span>
            <span className="font-semibold text-gold">
              {doneToday} / {totalToday} · {pctToday}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pctToday}%` }} />
          </div>
          <div className="text-[10px] text-text-dim">
            {habitsDone} hábito{habitsDone !== 1 ? "s" : ""} y {tasksDone} tarea{tasksDone !== 1 ? "s" : ""} hechas · quedan{" "}
            {pendingToday} por hacer
          </div>
        </div>
      </div>

      {(overdueTasks.length > 0 || upcomingAppointments.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {overdueTasks.length > 0 && (
            <a
              href="/dashboard/actividades?tiempo=vencidas"
              className="rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3.5 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/50"
            >
              ⚠ {overdueTasks.length} tarea{overdueTasks.length !== 1 ? "s" : ""} vencida
              {overdueTasks.length !== 1 ? "s" : ""}
            </a>
          )}
          {upcomingAppointments.map((a, i) => (
            <a
              key={a.id}
              href="/dashboard/citas"
              className={`rounded-lg px-3.5 py-1.5 text-xs transition-colors ${
                i === 0
                  ? "border border-gold/25 bg-gold/[0.06] text-gold hover:border-gold/50"
                  : "border border-border bg-bg-card text-text-muted"
              }`}
            >
              {APPT_ICON[a.type] ?? "📌"} {a.title} —{" "}
              {a.datetime.toLocaleString("es-CO", {
                timeZone: "America/Bogota",
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </a>
          ))}
          <span className="ml-auto text-[11px] text-text-dim">
            Vista: <span className="text-text-muted">día</span> · <span className="text-text-dim">semana</span>
          </span>
        </div>
      )}

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        <section className="flex flex-col rounded-xl border border-border bg-bg-card">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <h2 className="text-sm font-semibold text-text-primary">Tareas de hoy</h2>
            <span className="rounded-full border border-border bg-bg-card-2 px-2 py-0.5 text-[10px] text-text-muted">
              {dayTasks.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5 text-[11px]">
              {FILTROS.map((f) => (
                <a
                  key={f.id}
                  href={qsHome({ filtro: f.id === "todas" ? undefined : f.id })}
                  className={`rounded-md border px-2.5 py-1 ${
                    filtro === f.id ? "border-[#2a2a2a] bg-[#1e1e1e] text-[#e8e8e8]" : "border-[#2a2a2a] bg-bg-card-2 text-text-muted"
                  }`}
                >
                  {f.label}
                </a>
              ))}
              <a href="/dashboard/actividades" className="px-1.5 text-text-muted hover:text-gold">
                Ver todas →
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            {blocks.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-text-muted">Sin tareas para este día.</p>
            ) : (
              blocks.map((b) => (
                <div key={b.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">{b.label}</span>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[10px] text-text-dim">
                      {b.items.length} tarea{b.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {b.items.map((t) => {
                    const c = t.category ? CATS[t.category] : null;
                    return (
                      <ToggleRow
                        key={t.id}
                        boxed
                        label={t.title}
                        initialDone={t.status === "completada"}
                        action={toggleTaskStatus}
                        fieldsOn={{ id: t.id, nextStatus: "completada" }}
                        fieldsOff={{ id: t.id, nextStatus: "pendiente" }}
                        borderColor={c?.color}
                        prefix={
                          <span className="w-10 shrink-0 text-[11px] tabular-nums text-text-muted">{t.timeDue ?? "—"}</span>
                        }
                        meta={
                          <>
                            {c && (
                              <span
                                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                                style={{ background: `${c.color}14`, border: `1px solid ${c.color}33`, color: c.color }}
                              >
                                {c.label}
                              </span>
                            )}
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                t.priority === "alta" ? "bg-red-500/10 text-red-400" : t.priority === "media" ? "bg-gold/10 text-gold" : "bg-white/5 text-text-muted"
                              }`}
                            >
                              {t.priority}
                            </span>
                            <span className="shrink-0 text-xs text-text-dim">⋯</span>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div id="nueva-tarea" className="border-t border-border p-3">
            <form action={createTask} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="dueDate" value={date} />
              <input
                type="text"
                name="title"
                required
                placeholder="Nueva tarea para hoy…"
                className="min-w-[160px] flex-1 rounded-lg border border-border bg-bg-deep px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-dim"
              />
              <select name="priority" defaultValue="media" className="rounded-lg border border-border bg-bg-deep px-2.5 py-2 text-xs text-text-muted outline-none">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              <select name="category" defaultValue="" className="rounded-lg border border-border bg-bg-deep px-2.5 py-2 text-xs text-text-muted outline-none">
                <option value="">Sin categoría</option>
                {Object.entries(CATS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input type="time" name="timeDue" className="rounded-lg border border-border bg-bg-deep px-2.5 py-2 text-xs text-text-primary outline-none" />
              <button type="submit" className="btn-primary">
                + Agregar
              </button>
            </form>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col rounded-xl border border-border bg-bg-card">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-semibold text-text-primary">Hábitos de hoy</h2>
              <span className="rounded-full border border-gold/20 bg-gold/[0.08] px-2 py-0.5 text-[10px] text-gold">
                {habitsDone} / {dailyHabits.length}
              </span>
              <a href="/dashboard/habitos/rachas" className="ml-auto text-[11px] text-text-muted hover:text-gold">
                Rachas →
              </a>
            </div>
            <div className="px-3.5 pt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-purple-mid"
                  style={{ width: dailyHabits.length ? `${Math.round((habitsDone / dailyHabits.length) * 100)}%` : "0%" }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              {habitsView.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs text-text-muted">Sin hábitos diarios activos.</p>
              ) : (
                habitsView.map((h) => (
                  <ToggleRow
                    key={h.id}
                    boxed
                    circle
                    label={h.name}
                    sublabel={h.horaSugerida ?? "cualquier hora"}
                    initialDone={h.done}
                    action={toggleLogToday}
                    fieldsOn={{ activityId: h.id, date }}
                    fieldsOff={{ activityId: h.id, date }}
                    meta={
                      <>
                        <span className="flex shrink-0 gap-[2px]">
                          {h.week.map((c, i) => (
                            <span key={i} className="h-3.5 w-[7px] rounded-sm" style={{ background: c.done ? "#2d6a4f" : "#1a1a1a" }} />
                          ))}
                        </span>
                        <span className="shrink-0 rounded-full border border-gold/20 bg-gold/[0.08] px-2 py-0.5 text-[10px] font-semibold text-gold">
                          🔥 {h.streak}
                        </span>
                      </>
                    }
                  />
                ))
              )}
            </div>
            <div className="border-t border-border p-3">
              <form action={createActivity} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="frequency" value="diaria" />
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Nuevo hábito diario…"
                  className="min-w-[120px] flex-1 rounded-lg border border-border bg-bg-deep px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-dim"
                />
                <input type="time" name="horaSugerida" className="rounded-lg border border-border bg-bg-deep px-2.5 py-2 text-xs text-text-primary outline-none" />
                <button type="submit" className="btn-primary">
                  +
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-bg-card p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Por categoría</h2>
              <span className="text-[11px] text-text-muted">hoy</span>
            </div>
            {categoryLegend.length === 0 ? (
              <p className="text-xs text-text-muted">Sin tareas categorizadas hoy.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {categoryLegend.map((c) => (
                  <div key={c.key} className="flex items-center gap-2.5 text-xs text-text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: c.color }} />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="h-1 max-w-[90px] flex-1 overflow-hidden rounded-full bg-border">
                      <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                    </span>
                    <span className="min-w-[26px] text-right text-[11px] text-text-dim">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {upcomingTasks.length > 0 && (
        <section className="rounded-xl border border-border bg-bg-card p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-text-primary">Próximos 7 días</h2>
            <span className="rounded-full border border-border bg-bg-card-2 px-2 py-0.5 text-[10px] text-text-muted">
              {upcomingTasks.length} tarea{upcomingTasks.length !== 1 ? "s" : ""}
              {upcomingAppointments.length > 0 ? ` · ${upcomingAppointments.length} cita${upcomingAppointments.length !== 1 ? "s" : ""}` : ""}
            </span>
            <a href="/dashboard/actividades?tiempo=semana" className="ml-auto text-[11px] text-text-muted hover:text-gold">
              Ver todas →
            </a>
          </div>
          <div className="grid gap-x-6 gap-y-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
