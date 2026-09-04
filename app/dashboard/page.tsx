import { and, asc, eq, lt, ne, gte, lte, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
import { CATS } from "@/lib/constants/cats";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { ToggleRow } from "@/components/app/optimistic-toggle-row";
import {
  PageHeader,
  Card,
  MetricCard,
  Segmented,
  Stepper,
  Button,
  Badge,
  CategoryTag,
  CategoryDot,
  EmptyState,
  QuickCapture,
  Select,
  Input,
  catInfo,
} from "@/components/ui";
import { toggleTaskStatus, createTask } from "./actividades/actions";
import { toggleLogToday, createActivity } from "./habitos/actions";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-danger",
  media: "text-accent-warm",
  baja: "text-ink-dim",
};

const PRIORITY_TONE = { alta: "danger", media: "warm", baja: "neutral" } as const;

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

// Home del dashboard — arquetipo 6 (Panel resumen) del sistema IArcanIA.
// os.html combinaba esto con una vista muy personalizada (rutina 20/20/20,
// ~30 hábitos hardcodeados por ID, modo emergencia) que NOTES.md ya
// documentó como deliberadamente fuera de alcance. Aquí es un resumen real
// sobre las tablas migradas (tasks, activities/activity_logs, appointments):
// foco del día, hábitos pendientes, tareas de hoy, próximos 7 días. El
// navegador de día (‹ fecha ›) no puede ir al futuro, igual que el original.
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
      label: catInfo(key).label,
      color: catInfo(key).color,
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
    <div className="flex flex-col gap-4 p-8">
      <PageHeader
        icon="🌅"
        title={`Buen día${session!.user?.name ? `, ${session!.user.name}` : ""}`}
        subtitle={`${dateLong} · ${nowTime} · Bogotá`}
        actions={
          <>
            <Stepper
              prevHref={`/dashboard?date=${addDaysISO(date, -1)}`}
              nextHref={isToday ? undefined : `/dashboard?date=${addDaysISO(date, 1)}`}
              label={isToday ? "Hoy" : fmtDayShort(date)}
              current={isToday}
            />
            <Button variant="secondary" href={`/dashboard/agenda?date=${date}`}>
              Agenda del día
            </Button>
            <Button href="#nueva-tarea">+ Nueva tarea</Button>
          </>
        }
      />

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(4, 1fr) 1.6fr" }}>
        <MetricCard value={pendingToday} label="pendientes" sub="hoy" tone="primary" />
        <MetricCard value={doneToday} label="completadas" sub={`de ${totalToday}`} tone="success" />
        <MetricCard
          value={overdueTasks.length}
          label="vencidas"
          tone={overdueTasks.length ? "danger" : "primary"}
        />
        <MetricCard value={bestStreak} label="mejor racha" sub="días" tone="warm" />
        <div className="flex flex-col justify-center gap-2 rounded-ui-lg border border-accent/25 bg-accent/[0.06] px-3.5 py-3">
          <div className="flex justify-between text-meta text-ink-muted">
            <span>Progreso del día</span>
            <span className="font-semibold text-accent">
              {doneToday} / {totalToday} · {pctToday}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pctToday}%` }} />
          </div>
          <div className="text-[10px] text-ink-dim">
            {habitsDone} hábito{habitsDone !== 1 ? "s" : ""} y {tasksDone} tarea{tasksDone !== 1 ? "s" : ""} hechas ·
            quedan {pendingToday} por hacer
          </div>
        </div>
      </div>

      {(overdueTasks.length > 0 || upcomingAppointments.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {overdueTasks.length > 0 && (
            <a
              href="/dashboard/actividades?tiempo=vencidas"
              className="rounded-ui border border-danger/25 bg-danger/[0.06] px-3.5 py-1.5 text-xs text-danger transition-colors duration-120 hover:border-danger/50"
            >
              ⚠ {overdueTasks.length} tarea{overdueTasks.length !== 1 ? "s" : ""} vencida
              {overdueTasks.length !== 1 ? "s" : ""}
            </a>
          )}
          {upcomingAppointments.map((a, i) => (
            <a
              key={a.id}
              href="/dashboard/citas"
              className={`rounded-ui px-3.5 py-1.5 text-xs transition-colors duration-120 ${
                i === 0
                  ? "border border-accent-warm/25 bg-accent-warm/[0.06] text-accent-warm hover:border-accent-warm/50"
                  : "border border-line bg-surface text-ink-muted"
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
          <span className="ml-auto text-meta text-ink-dim">
            Vista: <span className="text-ink-muted">día</span> · <span className="text-ink-dim">semana</span>
          </span>
        </div>
      )}

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        <Card
          title="Tareas de hoy"
          count={dayTasks.length}
          action={
            <a href="/dashboard/actividades" className="hover:text-ink">
              Ver todas →
            </a>
          }
          flush
        >
          <div className="px-3.5 pt-3">
            <Segmented
              options={FILTROS.map((f) => ({
                label: f.label,
                href: qsHome({ filtro: f.id === "todas" ? undefined : f.id }),
                active: filtro === f.id,
              }))}
            />
          </div>
          <div className="flex flex-col gap-2.5 p-3.5">
            {blocks.length === 0 ? (
              <EmptyState icon="🗒️">
                No tienes tareas para este día. Agrégala con la barra de abajo.
              </EmptyState>
            ) : (
              blocks.map((b) => (
                <div key={b.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                      {b.label}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[10px] text-ink-dim">
                      {b.items.length} tarea{b.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {b.items.map((t) => (
                    <ToggleRow
                      key={t.id}
                      boxed
                      label={t.title}
                      initialDone={t.status === "completada"}
                      action={toggleTaskStatus}
                      fieldsOn={{ id: t.id, nextStatus: "completada" }}
                      fieldsOff={{ id: t.id, nextStatus: "pendiente" }}
                      borderColor={t.category ? catInfo(t.category).color : undefined}
                      prefix={
                        <span className="w-10 shrink-0 text-meta tabular-nums text-ink-dim">
                          {t.timeDue ?? "—"}
                        </span>
                      }
                      meta={
                        <>
                          {t.category && <CategoryTag category={t.category} />}
                          <Badge tone={PRIORITY_TONE[t.priority as keyof typeof PRIORITY_TONE] ?? "neutral"}>
                            {t.priority}
                          </Badge>
                          <span className="shrink-0 text-xs text-ink-dim">⋯</span>
                        </>
                      }
                    />
                  ))}
                </div>
              ))
            )}
          </div>
          <div id="nueva-tarea">
            <QuickCapture
              action={createTask}
              placeholder="Nueva tarea para hoy…"
              hidden={{ dueDate: date }}
              extras={
                <>
                  <Select name="priority" defaultValue="media">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </Select>
                  <Select name="category" defaultValue="">
                    <option value="">Sin categoría</option>
                    {Object.entries(CATS).map(([key, c]) => (
                      <option key={key} value={key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Input type="time" name="timeDue" />
                </>
              }
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            title="Hábitos de hoy"
            count={`${habitsDone} / ${dailyHabits.length}`}
            action={
              <a href="/dashboard/habitos/rachas" className="hover:text-ink">
                Rachas →
              </a>
            }
            flush
          >
            <div className="px-3.5 pt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent-warm"
                  style={{
                    width: dailyHabits.length
                      ? `${Math.round((habitsDone / dailyHabits.length) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              {habitsView.length === 0 ? (
                <EmptyState icon="🔥">
                  Aún no sigues ningún hábito diario. Crea el primero abajo.
                </EmptyState>
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
                            <span
                              key={i}
                              className={`h-3.5 w-[7px] rounded-[2px] ${c.done ? "bg-success/25" : "bg-surface-2"}`}
                            />
                          ))}
                        </span>
                        <Badge tone="warm">🔥 {h.streak}</Badge>
                      </>
                    }
                  />
                ))
              )}
            </div>
            <QuickCapture
              action={createActivity}
              name="name"
              placeholder="Nuevo hábito diario…"
              hidden={{ frequency: "diaria" }}
              submitLabel="+"
              extras={<Input type="time" name="horaSugerida" />}
            />
          </Card>

          <Card title="Por categoría" action={<span>hoy</span>}>
            {categoryLegend.length === 0 ? (
              <p className="text-xs text-ink-muted">Ninguna tarea de hoy tiene categoría.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {categoryLegend.map((c) => (
                  <div key={c.key} className="flex items-center gap-2.5 text-meta text-ink-muted">
                    <CategoryDot category={c.key} />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="h-1 max-w-[90px] flex-1 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${c.pct}%`, background: c.color }}
                      />
                    </span>
                    <span className="min-w-[26px] text-right text-meta text-ink-dim">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {upcomingTasks.length > 0 && (
        <Card
          title="Próximos 7 días"
          count={`${upcomingTasks.length} tarea${upcomingTasks.length !== 1 ? "s" : ""}${
            upcomingAppointments.length > 0
              ? ` · ${upcomingAppointments.length} cita${upcomingAppointments.length !== 1 ? "s" : ""}`
              : ""
          }`}
          action={
            <a href="/dashboard/actividades?tiempo=semana" className="hover:text-ink">
              Ver todas →
            </a>
          }
        >
          <div className="grid gap-x-6 gap-y-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {upcomingTasks.map((t) => {
              const cat = t.category ? catInfo(t.category) : null;
              return (
                <div key={t.id} className="flex min-w-0 items-center gap-2.5 py-1 text-sm">
                  <span className="w-24 shrink-0 whitespace-nowrap text-meta text-ink-dim">
                    {fmtDayShort(t.dueDate!)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">{t.title}</span>
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
        </Card>
      )}
    </div>
  );
}
