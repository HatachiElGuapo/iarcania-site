import { and, eq, lt, ne, gte, lte, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
import { planChecks } from "@/lib/db/schema/plan";
import { CATS } from "@/lib/constants/cats";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { buildDayEvents, type AgendaEvent } from "@/lib/agenda/day-events";
import { findPlanPersonForUser, loadPlanContextById, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import {
  PageHeader,
  Card,
  MetricCard,
  Stepper,
  Button,
  Badge,
  EmptyState,
  QuickCapture,
  Select,
  Input,
  catInfo,
} from "@/components/ui";
import { QuickAddPanel } from "@/components/ui/quick-add-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { ListCard } from "@/components/ui/list-card";
import { toggleTaskStatus, createTask } from "./actividades/actions";
import { toggleLogToday, createActivity, incrementLog, decrementLog } from "./habitos/actions";
import { setCheck } from "./plan/actions";
import { completeAppointment } from "./citas/actions";
import { NewTaskSheet } from "./new-task-sheet";
import { PlanBlockMenu } from "./plan/block-menu";
import { TaskHabitMenu } from "./day-row-menu";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-danger",
  media: "text-accent-warm",
  baja: "text-ink-dim",
};

const APPT_ICON: Record<string, string> = {
  medica: "🏥",
  odontologica: "🏥",
  reunion: "🎉",
  otro: "📌",
};

const PLAN_PENDING_LOOKBACK_DAYS = 14;
const HABIT_LOOKBACK_DAYS = 90;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Móvil · eyebrow de <SectionHeader> ("Martes 22 de septiembre", sin año —
// distinto de `dateLong`, que sí lo lleva, para el subtítulo de escritorio).
function fmtDayEyebrow(iso: string) {
  return capitalize(
    new Date(`${iso}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
}

function fmtDayShort(iso: string) {
  return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

// Home del dashboard — arquetipo 6 (Panel resumen) del sistema IArcanIA.
// "Tu día" es UNA lista mezclada por hora (tareas + hábitos + Plan + citas
// ya agendadas), la misma que arma /dashboard/agenda (lib/agenda/day-
// events.ts) — antes eran cards separadas por tipo y Plan no aparecía acá.
export default async function RutinasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; compose?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();
  const { date: dateParam, compose } = await searchParams;
  const date = dateParam && dateParam <= today ? dateParam : today;
  const composeOpen = compose === "1";
  const isToday = date === today;
  const now = new Date();
  const weekEnd = addDaysISO(date, 7);
  const lookbackStart = addDaysISO(date, -HABIT_LOOKBACK_DAYS);

  const [dayEvents, dailyHabits, habitLogs, overdueTasks, upcomingAppointments, upcomingTasks, vicios, viciosLogs] =
    await Promise.all([
    buildDayEvents(userId, date),
    db
      .select({ id: activities.id, name: activities.name, horaSugerida: activities.horaSugerida })
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, "diaria"))),
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
      .orderBy(appointments.datetime)
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
      .orderBy(tasks.dueDate, tasks.timeDue),
    db
      .select({ id: activities.id, name: activities.name })
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, "recurrente")))
      .orderBy(activities.name),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date))),
  ]);

  const viciosCounts = new Map<string, number>();
  for (const l of viciosLogs) viciosCounts.set(l.activityId, (viciosCounts.get(l.activityId) ?? 0) + 1);

  const events = [...dayEvents.events].sort((a, b) => a.start - b.start);
  const doneToday = events.filter((e) => e.done).length;
  const totalToday = events.length;
  const pendingToday = totalToday - doneToday;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  const logsByHabit = new Map<string, Set<string>>();
  for (const l of habitLogs) {
    if (!logsByHabit.has(l.activityId)) logsByHabit.set(l.activityId, new Set());
    logsByHabit.get(l.activityId)!.add(l.date);
  }
  const bestStreak = dailyHabits.length
    ? Math.max(...dailyHabits.map((h) => computeStreak(logsByHabit.get(h.id), date)))
    : 0;

  const habitsView = dailyHabits.map((h) => {
    const dates = logsByHabit.get(h.id);
    return {
      id: h.id,
      name: h.name,
      horaSugerida: h.horaSugerida,
      done: dates?.has(date) ?? false,
      streak: computeStreak(dates, date),
      week: weekCells(dates, date),
    };
  });
  const habitsDoneToday = habitsView.filter((h) => h.done).length;

  // Plan: bloques de los últimos PLAN_PENDING_LOOKBACK_DAYS días ANTERIORES
  // a hoy real que quedaron sin marcar (ni hecho ni saltado) — para que no
  // se pierdan silenciosamente al pasar de día sin cerrarlos. (El resto de
  // los bloques de Plan de HOY ya vienen mezclados en `events` arriba.)
  const planPerson = await findPlanPersonForUser(userId);
  let planPending: { blockId: string; date: string; startTime: string; text: string; kind: string }[] = [];
  if (planPerson) {
    const pendingFrom = addDaysISO(today, -PLAN_PENDING_LOOKBACK_DAYS);
    const planCtx = await loadPlanContextById(planPerson.planId);
    const resolvedRange = resolvePlan(toPlanData(planCtx), pendingFrom, today);
    const checksRange = await db
      .select({ blockId: planChecks.blockId, date: planChecks.date })
      .from(planChecks)
      .where(
        and(
          eq(planChecks.planId, planPerson.planId),
          eq(planChecks.personId, planPerson.personId),
          gte(planChecks.date, pendingFrom),
          lte(planChecks.date, today),
        ),
      );
    const checkedKeys = new Set(checksRange.map((c) => `${c.date}:${c.blockId}`));
    for (const day of resolvedRange) {
      if (day.date >= today) continue; // solo días ANTERIORES a hoy real
      for (const b of day.blocksByPerson[planPerson.personId] ?? []) {
        if (!checkedKeys.has(`${day.date}:${b.blockId}`)) {
          planPending.push({ blockId: b.blockId, date: day.date, startTime: b.startTime, text: b.text, kind: b.kind });
        }
      }
    }
  }

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

  return (
    <>
      <MobileHoy
        dateEyebrow={fmtDayEyebrow(date)}
        title={isToday ? "Hoy" : fmtDayShort(date)}
        isToday={isToday}
        date={date}
        doneToday={doneToday}
        totalToday={totalToday}
        pctToday={pctToday}
        composeOpen={composeOpen}
        overdueCount={overdueTasks.length}
        upcomingAppointments={upcomingAppointments}
        planPending={planPending}
        events={events}
        habitsView={habitsView}
        habitsDoneToday={habitsDoneToday}
        vicios={vicios}
        viciosCounts={viciosCounts}
        bestStreak={bestStreak}
        upcomingTasks={upcomingTasks}
      />
      <div className="hidden flex-col gap-4 p-8 md:flex">
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
            <QuickAddPanel
              trigger={
                <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-ui bg-accent px-3.5 py-2 text-body font-medium text-white transition-colors duration-120 hover:bg-accent/90">
                  + Nueva tarea
                </button>
              }
              title="Nueva tarea"
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
          <div className="text-[10px] text-ink-dim">Todo lo de hoy: tareas, hábitos, Plan y citas agendadas.</div>
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
        </div>
      )}

      {planPending.length > 0 && (
        <Card
          title="Plan · sin marcar"
          count={planPending.length}
          className="border-danger/25 bg-danger/[0.04]"
          action={
            <a href="/dashboard/plan/historial" className="hover:text-ink">
              Historial →
            </a>
          }
        >
          <p className="mb-2.5 text-meta text-ink-dim">
            De los últimos {PLAN_PENDING_LOOKBACK_DAYS} días — ni hecho ni saltado. Marcalos para no perder el
            rastro.
          </p>
          <div className="flex flex-col gap-1.5">
            {planPending.map((b) => {
              const kind = kindInfo(b.kind);
              return (
                <div
                  key={`${b.date}-${b.blockId}`}
                  className="flex items-center gap-2.5 rounded-ui bg-surface-sunken px-2.5 py-1.5 text-meta"
                >
                  <span className="shrink-0 tabular-nums text-ink-dim">{fmtDayShort(b.date)}</span>
                  <span className="shrink-0">{kind.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{b.text}</span>
                  <form action={setCheck} className="shrink-0">
                    <input type="hidden" name="date" value={b.date} />
                    <input type="hidden" name="blockId" value={b.blockId} />
                    <input type="hidden" name="status" value="done" />
                    <button
                      type="submit"
                      className="focus-ring rounded-ui border border-line px-1.5 py-0.5 text-[11px] text-ink-dim hover:border-success/40 hover:text-success"
                    >
                      ✓
                    </button>
                  </form>
                  <form action={setCheck} className="shrink-0">
                    <input type="hidden" name="date" value={b.date} />
                    <input type="hidden" name="blockId" value={b.blockId} />
                    <input type="hidden" name="status" value="skipped" />
                    <button
                      type="submit"
                      className="focus-ring rounded-ui border border-line px-1.5 py-0.5 text-[11px] text-ink-dim hover:border-danger/40 hover:text-danger"
                    >
                      ✗
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        <Card
          title="Tu día"
          count={`${doneToday} / ${totalToday}`}
          action={
            <QuickAddPanel
              trigger={<button className="text-accent hover:underline">+ Tarea</button>}
              title="Nueva tarea"
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
          }
          flush
        >
          <div className="flex flex-col divide-y divide-line">
            {events.length === 0 ? (
              <EmptyState icon="🗒️">No tienes nada para este día todavía — agrégalo con &ldquo;+ Tarea&rdquo;.</EmptyState>
            ) : (
              events.map((e) => <DayEventRow key={e.key} ev={e} date={date} />)
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            title="Hábitos"
            count={`${habitsDoneToday} / ${habitsView.length}`}
            action={
              <a href="/dashboard/habitos/rachas" className="text-accent hover:underline">
                Ver rachas →
              </a>
            }
            flush
          >
            <div className="px-3.5 pt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent-warm"
                  style={{
                    width: habitsView.length ? `${Math.round((habitsDoneToday / habitsView.length) * 100)}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              {habitsView.length === 0 ? (
                <EmptyState icon="🔥">Aún no sigues ningún hábito diario — creá el primero abajo.</EmptyState>
              ) : (
                habitsView.map((h) => (
                  <form key={h.id} action={toggleLogToday}>
                    <input type="hidden" name="activityId" value={h.id} />
                    <input type="hidden" name="date" value={date} />
                    <button
                      type="submit"
                      className="focus-ring flex w-full items-center gap-2.5 rounded-ui-lg border border-line bg-surface px-3.5 py-2.5 text-left transition-colors duration-120 hover:border-line-strong"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                          h.done ? "border-accent bg-accent text-white" : "border-line-strong"
                        }`}
                      >
                        {h.done ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${h.done ? "text-ink-dim line-through" : "text-ink"}`}>
                          {h.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-ink-dim">
                          {h.horaSugerida ?? "cualquier hora"}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-[2px]">
                        {h.week.map((c, i) => (
                          <span
                            key={i}
                            className={`h-3.5 w-[7px] rounded-[2px] ${c.done ? "bg-success/25" : "bg-surface-2"}`}
                          />
                        ))}
                      </span>
                      <Badge tone="warm">🔥 {h.streak}</Badge>
                    </button>
                  </form>
                ))
              )}
            </div>
            <div className="border-t border-line bg-surface-sunken px-3.5 py-2.5">
              <QuickAddPanel
                trigger={<button className="text-meta text-accent hover:underline">+ Nuevo hábito</button>}
                title="Nuevo hábito"
                action={createActivity}
                name="name"
                placeholder="Nombre del hábito…"
                hidden={{ frequency: "diaria" }}
                extras={<Input type="time" name="horaSugerida" />}
              />
            </div>
          </Card>

          <Card title="Vicios" count={vicios.length} flush>
            {vicios.length === 0 ? (
              <p className="px-3.5 py-3 text-xs text-ink-muted">
                Sin nada por acá todavía — agregá uno abajo (queda como hábito &quot;Recurrente&quot;, con
                contador en vez de un simple hecho/no hecho).
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {vicios.map((v) => {
                  const count = viciosCounts.get(v.id) ?? 0;
                  return (
                    <div key={v.id} className="flex items-center gap-2.5 px-3.5 py-2">
                      <span className="flex-1 truncate text-sm text-ink">{v.name}</span>
                      <form action={decrementLog}>
                        <input type="hidden" name="activityId" value={v.id} />
                        <input type="hidden" name="date" value={date} />
                        <button
                          type="submit"
                          disabled={count === 0}
                          className="focus-ring flex h-5 w-5 items-center justify-center rounded border border-line text-[11px] text-ink-dim hover:border-line-strong hover:text-ink disabled:opacity-30"
                        >
                          −
                        </button>
                      </form>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums text-ink">{count}</span>
                      <form action={incrementLog}>
                        <input type="hidden" name="activityId" value={v.id} />
                        <input type="hidden" name="date" value={date} />
                        <button
                          type="submit"
                          className="focus-ring flex h-5 w-5 items-center justify-center rounded border border-line text-[11px] text-ink-dim hover:border-line-strong hover:text-ink"
                        >
                          +
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
            <QuickCapture
              action={createActivity}
              name="name"
              placeholder="Nuevo vicio a contar…"
              hidden={{ frequency: "recurrente" }}
              submitLabel="+"
            />
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
    </>
  );
}

type RowAction = (formData: FormData) => void | Promise<void>;

// El toggle "principal" de cada fila — el que se dispara clickeando en
// cualquier parte de la fila, no solo un cuadradito chico. Plan además
// tiene "saltado" (✗) como control aparte, porque hecho/saltado no son
// opuestos de un solo booleano.
function primaryActionFor(
  ev: AgendaEvent,
  date: string,
): { action: RowAction; fields: Record<string, string> } | null {
  if (ev.kind === "block" && ev.itemType === "task" && ev.itemId) {
    return { action: toggleTaskStatus, fields: { id: ev.itemId, nextStatus: ev.done ? "pendiente" : "completada" } };
  }
  if ((ev.kind === "habit" || (ev.kind === "block" && ev.itemType === "habito")) && ev.itemId) {
    return { action: toggleLogToday, fields: { activityId: ev.itemId, date } };
  }
  if (ev.kind === "block" && ev.itemType === "cita" && ev.itemId) {
    return { action: completeAppointment, fields: { id: ev.itemId } };
  }
  if (ev.kind === "plan") {
    return { action: setCheck, fields: { date, blockId: ev.refId, status: ev.done ? "" : "done" } };
  }
  return null;
}

// Una fila de "Tu día". El contenido (hora, ícono, título, badge) va DENTRO
// de un <button type="submit"> que ocupa toda la fila — clickear en
// cualquier parte marca/desmarca, no solo un cuadradito. El control de
// "saltado" de Plan y el link de editar quedan aparte, afuera del botón
// grande, para no perder ese click más chico.
function DayEventRow({ ev, date }: { ev: AgendaEvent; date: string }) {
  const primary = primaryActionFor(ev, date);

  const content = (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
          ev.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="w-14 shrink-0 text-meta tabular-nums text-ink-dim">
        {ev.autoTime ? "—" : fmtTime(ev.start)}
      </span>
      <span className="shrink-0 text-[17px]">{ev.icon}</span>
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-body ${ev.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {ev.title}
        </span>
        {ev.habitChecks && ev.habitChecks.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1.5">
            {ev.habitChecks.map((h) => (
              <span key={h.name} className={`text-[10px] ${h.done ? "text-success" : "text-ink-dim"}`}>
                {h.done ? "✓" : "○"} {h.name}
              </span>
            ))}
          </span>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: `${ev.accent}22`, color: ev.accent }}
      >
        {ev.badge}
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-2 px-3.5 py-1">
      {primary ? (
        <form action={primary.action} className="min-w-0 flex-1">
          {Object.entries(primary.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button
            type="submit"
            className="focus-ring flex w-full items-center gap-3 rounded-ui py-2.5 text-left transition-colors duration-120 hover:bg-surface-2"
          >
            {content}
          </button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5">{content}</div>
      )}
      {ev.kind === "plan" && (
        <form action={setCheck} className="shrink-0">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="blockId" value={ev.refId} />
          <input type="hidden" name="status" value="skipped" />
          <button
            type="submit"
            title="Saltado"
            className="focus-ring rounded-ui border border-line px-2 py-1 text-[12px] text-ink-dim hover:border-danger/40 hover:text-danger"
          >
            ✗
          </button>
        </form>
      )}
      {ev.editHref && ev.kind !== "plan" && (
        <a href={ev.editHref} className="shrink-0 px-1 text-meta text-ink-dim hover:text-ink">
          ⋯
        </a>
      )}
    </div>
  );
}

// ── Móvil · "Hoy" (pantalla 01 del diseño "App Movil") ──────────────────
// Mismos datos que la vista de escritorio de arriba (`events`, `habitsView`,
// `vicios`…, ya calculados en <RutinasPage>) y las mismas Server Actions —
// solo cambia cómo se pintan: una sola columna, filas <ListCard> con
// objetivo táctil de 44px, texto a 15px. Oculto desde `md` (el layout de
// escritorio no se toca).

type MobileHoyProps = {
  dateEyebrow: string;
  title: string;
  isToday: boolean;
  date: string;
  doneToday: number;
  totalToday: number;
  pctToday: number;
  composeOpen: boolean;
  overdueCount: number;
  upcomingAppointments: { id: string; title: string; type: string; datetime: Date }[];
  planPending: { blockId: string; date: string; startTime: string; text: string; kind: string }[];
  events: AgendaEvent[];
  habitsView: {
    id: string;
    name: string;
    horaSugerida: string | null;
    done: boolean;
    streak: number;
    week: { done: boolean }[];
  }[];
  habitsDoneToday: number;
  vicios: { id: string; name: string }[];
  viciosCounts: Map<string, number>;
  bestStreak: number;
  upcomingTasks: { id: string; dueDate: string | null; title: string; category: string | null; priority: string }[];
};

function MobileHoy({
  dateEyebrow,
  title,
  isToday,
  date,
  doneToday,
  totalToday,
  pctToday,
  composeOpen,
  overdueCount,
  upcomingAppointments,
  planPending,
  events,
  habitsView,
  habitsDoneToday,
  vicios,
  viciosCounts,
  bestStreak,
  upcomingTasks,
}: MobileHoyProps) {
  return (
    <div className="flex flex-col gap-6 p-4 pb-28 md:hidden">
      <SectionHeader
        eyebrow={dateEyebrow}
        title={title}
        action={
          <Stepper
            prevHref={`/dashboard?date=${addDaysISO(date, -1)}`}
            nextHref={isToday ? undefined : `/dashboard?date=${addDaysISO(date, 1)}`}
            label={isToday ? "Hoy" : fmtDayShort(date)}
            current={isToday}
          />
        }
        progress={{ value: `${doneToday} / ${totalToday}`, pct: pctToday }}
      />

      {(overdueCount > 0 || upcomingAppointments.length > 0) && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {overdueCount > 0 && (
            <a
              href="/dashboard/actividades?tiempo=vencidas"
              className="flex min-h-11 shrink-0 items-center rounded-ui border border-danger/25 bg-danger/[0.06] px-3.5 text-[13px] text-danger"
            >
              ⚠ {overdueCount} vencida{overdueCount !== 1 ? "s" : ""}
            </a>
          )}
          {upcomingAppointments.map((a) => (
            <a
              key={a.id}
              href="/dashboard/citas"
              className="flex min-h-11 shrink-0 items-center rounded-ui border border-accent-warm/25 bg-accent-warm/[0.06] px-3.5 text-[13px] text-accent-warm"
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
        </div>
      )}

      {planPending.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-danger">
            Plan · sin marcar
          </div>
          <div className="flex flex-col gap-1.5">
            {planPending.map((b) => {
              const kind = kindInfo(b.kind);
              return (
                <ListCard key={`${b.date}-${b.blockId}`} tone="surface-2">
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">{fmtDayShort(b.date)}</span>
                  <span className="shrink-0 text-[15px]">{kind.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{b.text}</span>
                  <form action={setCheck} className="shrink-0">
                    <input type="hidden" name="date" value={b.date} />
                    <input type="hidden" name="blockId" value={b.blockId} />
                    <input type="hidden" name="status" value="done" />
                    <button
                      type="submit"
                      className="focus-ring flex h-9 w-9 items-center justify-center rounded-ui border border-line text-[13px] text-ink-dim"
                    >
                      ✓
                    </button>
                  </form>
                  <form action={setCheck} className="shrink-0">
                    <input type="hidden" name="date" value={b.date} />
                    <input type="hidden" name="blockId" value={b.blockId} />
                    <input type="hidden" name="status" value="skipped" />
                    <button
                      type="submit"
                      className="focus-ring flex h-9 w-9 items-center justify-center rounded-ui border border-line text-[13px] text-ink-dim"
                    >
                      ✗
                    </button>
                  </form>
                </ListCard>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Mi día</div>
          <NewTaskSheet
            action={createTask}
            date={date}
            openSignal={composeOpen}
            trigger={<button className="text-[13px] text-accent">+ Tarea</button>}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {events.length === 0 ? (
            <EmptyState icon="🗒️">No tienes nada para este día todavía — agrégalo con &ldquo;+ Tarea&rdquo;.</EmptyState>
          ) : (
            events.map((ev) => <MobileDayRow key={ev.key} ev={ev} date={date} />)
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Hábitos</div>
          <span className="text-[11px] text-ink-dim">
            {habitsDoneToday} / {habitsView.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {habitsView.length === 0 ? (
            <EmptyState icon="🔥">Aún no sigues ningún hábito diario.</EmptyState>
          ) : (
            habitsView.map((h) => <MobileHabitRow key={h.id} h={h} date={date} />)
          )}
        </div>
        <QuickAddPanel
          trigger={<button className="self-start text-[12px] text-accent">+ Nuevo hábito</button>}
          title="Nuevo hábito"
          action={createActivity}
          name="name"
          placeholder="Nombre del hábito…"
          hidden={{ frequency: "diaria" }}
          extras={<Input type="time" name="horaSugerida" />}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Vicios</div>
        {vicios.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Sin nada por acá todavía — agregá uno abajo (queda como hábito &quot;Recurrente&quot;, con contador
            en vez de un simple hecho/no hecho).
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {vicios.map((v) => (
              <MobileVicioRow key={v.id} v={v} count={viciosCounts.get(v.id) ?? 0} date={date} />
            ))}
          </div>
        )}
        <QuickCapture
          action={createActivity}
          name="name"
          placeholder="Nuevo vicio a contar…"
          hidden={{ frequency: "recurrente" }}
          submitLabel="+"
          className="rounded-ui-lg border border-line bg-surface-sunken"
        />
      </div>

      <div className="flex items-center gap-3 rounded-ui-lg border border-line bg-surface-2 px-3.5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-ink">Mi racha</div>
          <div className="mt-0.5 text-[11px] text-ink-dim">mejor racha: {bestStreak} días</div>
        </div>
        <Badge tone="warm">🔥 {bestStreak}</Badge>
      </div>

      {upcomingTasks.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Próximos 7 días
            </div>
            <a href="/dashboard/actividades?tiempo=semana" className="text-[11px] text-ink-dim">
              Ver todas →
            </a>
          </div>
          <div className="flex flex-col gap-1.5">
            {upcomingTasks.map((t) => {
              const cat = t.category ? catInfo(t.category) : null;
              return (
                <ListCard key={t.id} accent={cat?.color}>
                  <span className="w-12 shrink-0 whitespace-nowrap text-[11px] text-ink-dim">
                    {fmtDayShort(t.dueDate!)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{t.title}</span>
                  <span className={`text-[13px] font-semibold ${PRIORITY_COLOR[t.priority]}`}>●</span>
                </ListCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileDayRow({ ev, date }: { ev: AgendaEvent; date: string }) {
  const primary = primaryActionFor(ev, date);

  const row = (
    <ListCard accent={ev.accent}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
          ev.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="w-11 shrink-0 text-[11px] tabular-nums text-ink-dim">
        {ev.autoTime ? "—" : fmtTime(ev.start)}
      </span>
      <span className="shrink-0 text-[16px]">{ev.icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] leading-tight ${ev.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {ev.title}
        </div>
        {ev.habitChecks && ev.habitChecks.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {ev.habitChecks.map((h) => (
              <span key={h.name} className={`text-[10px] ${h.done ? "text-success" : "text-ink-dim"}`}>
                {h.done ? "✓" : "○"} {h.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {ev.badge && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
          style={{ background: `${ev.accent}22`, color: ev.accent }}
        >
          {ev.badge}
        </span>
      )}
    </ListCard>
  );

  return (
    <div className="flex items-center gap-2">
      {primary ? (
        <form action={primary.action} className="min-w-0 flex-1">
          {Object.entries(primary.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit" className="contents">
            {row}
          </button>
        </form>
      ) : (
        <div className="min-w-0 flex-1">{row}</div>
      )}
      {ev.kind === "plan" && (
        <PlanBlockMenu date={date} blockId={ev.refId} startTime={fmtTime(ev.start)} text={ev.title} isSkipped={false} />
      )}
      {ev.itemType === "task" && ev.itemId && (
        <TaskHabitMenu
          kind="task"
          id={ev.itemId}
          date={date}
          startTime={ev.autoTime ? "" : fmtTime(ev.start)}
          title={ev.title}
          detailHref="/dashboard/actividades"
        />
      )}
      {(ev.itemType === "habit" || ev.itemType === "habito") && ev.itemId && (
        <TaskHabitMenu
          kind="habit"
          id={ev.itemId}
          date={date}
          startTime={ev.autoTime ? "" : fmtTime(ev.start)}
          title={ev.title}
          detailHref="/dashboard/habitos"
        />
      )}
    </div>
  );
}

function MobileHabitRow({
  h,
  date,
}: {
  h: { id: string; name: string; horaSugerida: string | null; done: boolean; streak: number; week: { done: boolean }[] };
  date: string;
}) {
  return (
    <form action={toggleLogToday}>
      <input type="hidden" name="activityId" value={h.id} />
      <input type="hidden" name="date" value={date} />
      <button type="submit" className="contents">
        <ListCard>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              h.done ? "border-accent bg-accent text-white" : "border-line-strong"
            }`}
          >
            {h.done ? "✓" : ""}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`truncate text-[15px] ${h.done ? "text-ink-dim line-through" : "text-ink"}`}>
              {h.name}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-dim">{h.horaSugerida ?? "cualquier hora"}</div>
          </div>
          <span className="flex shrink-0 gap-[2px]">
            {h.week.map((c, i) => (
              <span key={i} className={`h-3.5 w-[7px] rounded-[2px] ${c.done ? "bg-success/25" : "bg-surface-2"}`} />
            ))}
          </span>
          <Badge tone="warm">🔥 {h.streak}</Badge>
        </ListCard>
      </button>
    </form>
  );
}

function MobileVicioRow({ v, count, date }: { v: { id: string; name: string }; count: number; date: string }) {
  return (
    <ListCard>
      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{v.name}</span>
      <form action={decrementLog}>
        <input type="hidden" name="activityId" value={v.id} />
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          disabled={count === 0}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim disabled:opacity-30"
        >
          −
        </button>
      </form>
      <span className="w-6 shrink-0 text-center text-[15px] font-semibold tabular-nums text-ink">{count}</span>
      <form action={incrementLog}>
        <input type="hidden" name="activityId" value={v.id} />
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim"
        >
          +
        </button>
      </form>
    </ListCard>
  );
}
