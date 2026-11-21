import { and, eq, isNull, lt, ne, gte, lte, gt, inArray } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { appointments } from "@/lib/db/schema/citas";
import { planChecks } from "@/lib/db/schema/plan";
import { CATS } from "@/lib/constants/cats";
import { todayISO, addDaysISO, nowHHMM } from "@/lib/date/bogota";
import { buildDayEvents, type AgendaEvent } from "@/lib/agenda/day-events";
import { fmtTime, fmtDuration } from "@/lib/agenda/time";
import { findPlanPersonForUser, loadPlanContextById, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import { getOrphanActivities, getOrphanPlanBlocks, type OrphanActivity, type OrphanPlanBlock } from "@/lib/plan/orphans";
import { getPendingMinimumsForPerson, getPendingSecondaryHabits, type PendingMinimumBlock, type PendingSecondaryHabit } from "@/lib/plan/pending";
import { computeVicioStats, type VicioStats } from "@/lib/habits/vicio-stats";
import { isCounterDone } from "@/lib/habits/counter";
import { getSecondaryHabitsForPerson, groupSecondaryEntries, type SecondaryBand, type SecondaryEntry } from "@/lib/plan/secondary";
import { SecondaryCard } from "./secondary-section";
import { HabitsCard } from "./habits-card";
import { BlockIcon } from "@/lib/icons/habit-icons";
import { getStreakForPerson } from "@/lib/plan/streak";
import { getDailyActions } from "@/lib/trabajo/daily-actions";
import { ActionsCard, TodayFocusList, type DayActions } from "./acciones/actions-card";
import { ActionsModalProvider, ActionsHeaderButton } from "./acciones/actions-context";
import { MORNING_END, EVENING_START, MORNING_END_MIN, EVENING_START_MIN } from "@/lib/agenda/day-sections";
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
import { createTask } from "./actividades/actions";
import { createActivity, incrementLog, decrementLog } from "./habitos/actions";
import { NewTaskSheet } from "./new-task-sheet";
import { DayEventRow } from "./day-event-row";
import { MobileDayRow } from "./mobile-day-row";
import { DayTimeline } from "./day-timeline";
import { primaryActionFor } from "@/lib/plan/primary-action";
import { PlanBlockMenu } from "./plan/block-menu";
import { TaskHabitMenu } from "./day-row-menu";
import { SafeActionButton } from "./safe-action-button";
import { PlanCheckButton, PlanSkipButton } from "./plan/block-check";
import { DeferButton } from "./plan/defer-button";
import { PendingPanel } from "./pending-panel";
import { OverduePanel, type OverdueTask } from "./overdue-panel";
import { ReviewSection } from "./review-section";

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
      .select({
        id: activities.id,
        name: activities.name,
        horaSugerida: activities.horaSugerida,
        sortOrder: activities.sortOrder,
        icon: activities.icon,
        targetValue: activities.targetValue,
        unit: activities.unit,
        countSteps: activities.countSteps,
      })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.isActive, true),
          eq(activities.frequency, "diaria"),
          isNull(activities.parentId),
        ),
      ),
    db
      .select({ activityId: activityLogs.activityId, date: activityLogs.date, value: activityLogs.value })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), gte(activityLogs.date, lookbackStart), lte(activityLogs.date, date))),
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, category: tasks.category })
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

  // Racha de días sin registrar, mejor racha y último registro — todo el
  // historial (sin recorte por lookback), una sola query extra solo si
  // hay vicios. Se computa en memoria (lib/habits/vicio-stats.ts), sin
  // tabla nueva.
  const vicioIds = vicios.map((v) => v.id);
  const vicioAllLogs = vicioIds.length
    ? await db
        .select({ activityId: activityLogs.activityId, date: activityLogs.date })
        .from(activityLogs)
        .where(and(eq(activityLogs.userId, userId), inArray(activityLogs.activityId, vicioIds)))
    : [];
  const vicioDatesById = new Map<string, string[]>();
  for (const l of vicioAllLogs) {
    if (!vicioDatesById.has(l.activityId)) vicioDatesById.set(l.activityId, []);
    vicioDatesById.get(l.activityId)!.push(l.date);
  }
  const vicioStatsById = new Map<string, VicioStats>();
  for (const v of vicios) vicioStatsById.set(v.id, computeVicioStats(vicioDatesById.get(v.id) ?? [], today));

  const events = [...dayEvents.events].sort((a, b) => a.start - b.start);
  const doneToday = events.filter((e) => e.done).length;
  const totalToday = events.length;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  // "Tu día" en 3 secciones por horario — el límite sale de configuración
  // (lib/agenda/day-sections.ts), nunca del texto de los bloques. Matutina
  // se despliega sola mientras tenga algo sin hacer, se pliega al
  // completarse; nocturna se abre desde las 17:30 (solo relevante para
  // hoy — otros días queda cerrada hasta que se la abra a mano).
  const morningEvents = events.filter((e) => e.start < MORNING_END_MIN);
  const middayEvents = events.filter((e) => e.start >= MORNING_END_MIN && e.start < EVENING_START_MIN);
  const nightEvents = events.filter((e) => e.start >= EVENING_START_MIN);
  const morningDone = morningEvents.filter((e) => e.done).length;
  const middayDone = middayEvents.filter((e) => e.done).length;
  const nightDone = nightEvents.filter((e) => e.done).length;
  const morningOpen = morningEvents.length > 0 && morningDone < morningEvents.length;
  const nightOpen = isToday && nowHHMM() >= "17:30";

  const logsByHabit = new Map<string, Set<string>>();
  const todayValueByHabit = new Map<string, number>();
  for (const l of habitLogs) {
    if (!logsByHabit.has(l.activityId)) logsByHabit.set(l.activityId, new Set());
    logsByHabit.get(l.activityId)!.add(l.date);
    if (l.date === date) todayValueByHabit.set(l.activityId, l.value);
  }
  const bestStreak = dailyHabits.length
    ? Math.max(...dailyHabits.map((h) => computeStreak(logsByHabit.get(h.id), date)))
    : 0;

  const habitsView = dailyHabits
    .map((h) => {
      const dates = logsByHabit.get(h.id);
      const currentValue = todayValueByHabit.get(h.id) ?? 0;
      const done = h.targetValue != null ? isCounterDone(currentValue, h.targetValue) : (dates?.has(date) ?? false);
      return {
        id: h.id,
        name: h.name,
        horaSugerida: h.horaSugerida,
        sortOrder: h.sortOrder,
        icon: h.icon,
        targetValue: h.targetValue,
        unit: h.unit,
        countSteps: h.countSteps,
        currentValue,
        done,
        streak: computeStreak(dates, date),
        week: weekCells(dates, date),
      };
    })
    // hora_sugerida ascendente (sin hora al final), luego sort_order, luego nombre.
    .sort(
      (a, b) =>
        (a.horaSugerida ?? "99:99").localeCompare(b.horaSugerida ?? "99:99") ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );
  const habitsDoneToday = habitsView.filter((h) => h.done).length;

  // Plan: bloques de AYER (y solo ayer) que quedaron sin marcar (ni hecho
  // ni saltado) — para cerrarlos rápido antes de que se pierda el rastro.
  // Con el cursor de la cola (ver resolve.ts), un bloque sin marcar YA NO
  // se pierde — el mismo item sigue tocando al día siguiente — así que ya
  // no hace falta mirar varios días atrás, alcanza con el último. Nunca
  // antes de plans.start_date: si el plan se reinició desde hoy, ayer es
  // de la versión vieja y no hay nada que resolver ahí.
  const planPerson = await findPlanPersonForUser(userId);
  let planPending: { blockId: string; date: string; startTime: string; text: string; kind: string }[] = [];
  let pendingMinimums: PendingMinimumBlock[] = [];
  let pendingSecondary: PendingSecondaryHabit[] = [];
  let secondaryGroups: Record<SecondaryBand, SecondaryEntry[]> = { manana: [], tarde: [], noche: [] };
  let streakResult = { streak: 0, protectors: 0, best: 0 };
  const yesterday = addDaysISO(today, -1);
  if (planPerson) {
    const planCtx = await loadPlanContextById(planPerson.planId);
    secondaryGroups = groupSecondaryEntries(await getSecondaryHabitsForPerson(planCtx, userId, planPerson.personId, date));
    if (isToday) {
      [pendingMinimums, pendingSecondary, streakResult] = await Promise.all([
        getPendingMinimumsForPerson(planCtx, planPerson.personId, today, nowHHMM()),
        getPendingSecondaryHabits(planCtx, userId, planPerson.personId, today, nowHHMM()),
        getStreakForPerson(planCtx, planPerson.personId, today),
      ]);
    }
    if (yesterday >= planCtx.plan.startDate) {
      const resolvedYesterday = resolvePlan(toPlanData(planCtx), yesterday, yesterday);
      const checksYesterday = await db
        .select({ blockId: planChecks.blockId })
        .from(planChecks)
        .where(
          and(
            eq(planChecks.planId, planPerson.planId),
            eq(planChecks.personId, planPerson.personId),
            eq(planChecks.date, yesterday),
          ),
        );
      const checkedBlockIds = new Set(checksYesterday.map((c) => c.blockId));
      const [day] = resolvedYesterday;
      for (const b of day?.blocksByPerson[planPerson.personId] ?? []) {
        if (!checkedBlockIds.has(b.blockId)) {
          planPending.push({ blockId: b.blockId, date: yesterday, startTime: b.startTime, text: b.text, kind: b.kind });
        }
      }
    }
  }
  const pendingSecondaryIds = pendingSecondary.map((p) => p.activityId);

  const tomorrow = addDaysISO(today, 1);
  const [hoyActions, mananaActions] = await Promise.all([
    getDailyActions(userId, today),
    getDailyActions(userId, tomorrow),
  ]);

  const [orphanActivities, orphanBlocks] = await Promise.all([
    getOrphanActivities(userId),
    planPerson ? getOrphanPlanBlocks(planPerson.planId) : Promise.resolve([]),
  ]);

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
    <ActionsModalProvider>
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
        overdueTasks={overdueTasks}
        upcomingAppointments={upcomingAppointments}
        planPending={planPending}
        events={events}
        morningEvents={morningEvents}
        middayEvents={middayEvents}
        nightEvents={nightEvents}
        morningDone={morningDone}
        middayDone={middayDone}
        nightDone={nightDone}
        morningOpen={morningOpen}
        nightOpen={nightOpen}
        habitsView={habitsView}
        habitsDoneToday={habitsDoneToday}
        vicios={vicios}
        viciosCounts={viciosCounts}
        vicioStatsById={vicioStatsById}
        secondaryGroups={secondaryGroups}
        pendingSecondaryIds={pendingSecondaryIds}
        hoyActions={hoyActions}
        mananaActions={mananaActions}
        today={today}
        tomorrow={tomorrow}
        streakResult={streakResult}
        bestStreak={bestStreak}
        upcomingTasks={upcomingTasks}
        orphanActivities={orphanActivities}
        orphanBlocks={orphanBlocks}
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
            <ActionsHeaderButton />
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
        <PendingPanel
          trigger={
            <button type="button" className="focus-ring block w-full text-left">
              <MetricCard
                value={pendingMinimums.length}
                label="pendientes"
                sub={
                  pendingSecondary.length > 0
                    ? `${pendingMinimums.length} mínimos · ${pendingSecondary.length} secundarios`
                    : "mínimos vencidos"
                }
                tone="primary"
              />
            </button>
          }
          pendingMinimums={pendingMinimums}
          pendingSecondary={pendingSecondary}
          date={today}
        />
        <MetricCard value={doneToday} label="completadas" sub={`de ${totalToday}`} tone="success" />
        <OverduePanel
          trigger={
            <button type="button" className="focus-ring block w-full text-left">
              <MetricCard
                value={overdueTasks.length}
                label="vencidas"
                tone={overdueTasks.length ? "danger" : "primary"}
              />
            </button>
          }
          tasks={overdueTasks}
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

      {planPerson && (
        <div className="flex items-center gap-2 text-meta text-ink-muted">
          <span>
            🔥 Racha de Plan: <span className="font-semibold text-ink">{streakResult.streak}</span> día
            {streakResult.streak !== 1 ? "s" : ""}
          </span>
          {streakResult.protectors > 0 && (
            <span>
              · 🛡️ {streakResult.protectors} protector{streakResult.protectors !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      )}

      {(overdueTasks.length > 0 || upcomingAppointments.length > 0) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {overdueTasks.length > 0 && (
            <OverduePanel
              trigger={
                <button
                  type="button"
                  className="focus-ring rounded-ui border border-danger/25 bg-danger/[0.06] px-3.5 py-1.5 text-xs text-danger transition-colors duration-120 hover:border-danger/50"
                >
                  ⚠ {overdueTasks.length} tarea{overdueTasks.length !== 1 ? "s" : ""} vencida
                  {overdueTasks.length !== 1 ? "s" : ""}
                </button>
              }
              tasks={overdueTasks}
            />
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
          <p className="mb-2.5 text-meta text-ink-dim">De ayer — ni hecho ni saltado. Marcalos para no perder el rastro.</p>
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
                  <PlanCheckButton
                    date={b.date}
                    blockId={b.blockId}
                    isDone={false}
                    className="focus-ring shrink-0 rounded-ui border border-line px-1.5 py-0.5 text-[11px] text-ink-dim hover:border-success/40 hover:text-success"
                  >
                    ✓
                  </PlanCheckButton>
                  <PlanSkipButton
                    date={b.date}
                    blockId={b.blockId}
                    isSkipped={false}
                    className="focus-ring shrink-0 rounded-ui border border-line px-1.5 py-0.5 text-[11px] text-ink-dim hover:border-danger/40 hover:text-danger"
                  >
                    ✗
                  </PlanSkipButton>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ReviewSection orphanActivities={orphanActivities} orphanBlocks={orphanBlocks} />

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        <div className="flex flex-col gap-4">
          <details open={morningOpen} className="overflow-hidden rounded-ui-lg border border-line bg-surface">
            <summary className="flex cursor-pointer items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                ☀ Rutina matutina
              </span>
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-ink-muted">
                {morningDone} / {morningEvents.length}
              </span>
            </summary>
            <div className="flex flex-col divide-y divide-line">
              {morningEvents.length === 0 ? (
                <EmptyState icon="☀️">Nada agendado antes de las {MORNING_END}.</EmptyState>
              ) : (
                morningEvents.map((e) => <DayEventRow key={e.key} ev={e} date={date} secondaryGroups={secondaryGroups} />)
              )}
            </div>
          </details>

          <Card
            title="Tu día"
            count={`${middayDone} / ${middayEvents.length}`}
            className="border-accent/40 ring-1 ring-accent/15"
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
            <TodayFocusList focus={hoyActions.focus} date={today} />
            <div className="flex flex-col divide-y divide-line">
              {middayEvents.length === 0 ? (
                <EmptyState icon="🗒️">No tienes nada para este día todavía — agrégalo con &ldquo;+ Tarea&rdquo;.</EmptyState>
              ) : (
                <DayTimeline
                  items={middayEvents.map((e) => ({
                    key: e.key,
                    start: e.start,
                    end: e.start + e.duration,
                    done: e.done,
                    node: <DayEventRow ev={e} date={date} secondaryGroups={secondaryGroups} />,
                  }))}
                  isToday={isToday}
                />
              )}
            </div>
          </Card>

          <details open={nightOpen} className="overflow-hidden rounded-ui-lg border border-line bg-surface">
            <summary className="flex cursor-pointer items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                ☾ Rutina nocturna
              </span>
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-ink-muted">
                {nightDone} / {nightEvents.length}
              </span>
            </summary>
            <div className="flex flex-col divide-y divide-line">
              {nightEvents.length === 0 ? (
                <EmptyState icon="☾">Nada agendado desde las {EVENING_START}.</EmptyState>
              ) : (
                nightEvents.map((e) => <DayEventRow key={e.key} ev={e} date={date} secondaryGroups={secondaryGroups} />)
              )}
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-4">
          <ActionsCard
            hoy={{ date: today, ...hoyActions }}
            manana={{ date: tomorrow, ...mananaActions }}
          />

          <HabitsCard
            streak={streakResult.streak}
            best={streakResult.best}
            protectors={streakResult.protectors}
            habitsView={habitsView}
            date={date}
          />

          <SecondaryCard groups={secondaryGroups} pendingActivityIds={pendingSecondaryIds} date={date} />

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
                  const stats = vicioStatsById.get(v.id);
                  return (
                    <div key={v.id} className="flex items-center gap-2.5 px-3.5 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{v.name}</span>
                        <span className="block truncate text-[10px] text-ink-dim">
                          {stats?.lastDate
                            ? `${stats.daysSinceLast} día${stats.daysSinceLast === 1 ? "" : "s"} sin · mejor racha ${stats.bestStreak} · último ${stats.lastDate}`
                            : "sin registros todavía"}
                        </span>
                      </div>
                      <SafeActionButton
                        action={decrementLog}
                        fields={{ activityId: v.id, date }}
                        disabled={count === 0}
                        className="focus-ring flex h-5 w-5 items-center justify-center rounded border border-line text-[11px] text-ink-dim hover:border-line-strong hover:text-ink disabled:opacity-30"
                      >
                        −
                      </SafeActionButton>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums text-ink">{count}</span>
                      <SafeActionButton
                        action={incrementLog}
                        fields={{ activityId: v.id, date }}
                        className="focus-ring flex h-5 w-5 items-center justify-center rounded border border-line text-[11px] text-ink-dim hover:border-line-strong hover:text-ink"
                      >
                        +
                      </SafeActionButton>
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
            <Link href="/dashboard/actividades?tiempo=semana" className="hover:text-ink">
              Ver todas →
            </Link>
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
    </ActionsModalProvider>
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
  overdueTasks: OverdueTask[];
  upcomingAppointments: { id: string; title: string; type: string; datetime: Date }[];
  planPending: { blockId: string; date: string; startTime: string; text: string; kind: string }[];
  events: AgendaEvent[];
  morningEvents: AgendaEvent[];
  middayEvents: AgendaEvent[];
  nightEvents: AgendaEvent[];
  morningDone: number;
  middayDone: number;
  nightDone: number;
  morningOpen: boolean;
  nightOpen: boolean;
  habitsView: {
    id: string;
    name: string;
    horaSugerida: string | null;
    icon: string | null;
    targetValue: number | null;
    unit: string | null;
    countSteps: number[] | null;
    currentValue: number;
    done: boolean;
    streak: number;
    week: { done: boolean }[];
  }[];
  habitsDoneToday: number;
  vicios: { id: string; name: string }[];
  viciosCounts: Map<string, number>;
  vicioStatsById: Map<string, VicioStats>;
  secondaryGroups: Record<SecondaryBand, SecondaryEntry[]>;
  pendingSecondaryIds: string[];
  hoyActions: { focus: DayActions["focus"]; others: DayActions["others"] };
  mananaActions: { focus: DayActions["focus"]; others: DayActions["others"] };
  today: string;
  tomorrow: string;
  streakResult: { streak: number; protectors: number; best: number };
  bestStreak: number;
  upcomingTasks: { id: string; dueDate: string | null; title: string; category: string | null; priority: string }[];
  orphanActivities: OrphanActivity[];
  orphanBlocks: OrphanPlanBlock[];
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
  overdueTasks,
  upcomingAppointments,
  planPending,
  events,
  morningEvents,
  middayEvents,
  nightEvents,
  morningDone,
  middayDone,
  nightDone,
  morningOpen,
  nightOpen,
  habitsView,
  habitsDoneToday,
  vicios,
  viciosCounts,
  vicioStatsById,
  secondaryGroups,
  pendingSecondaryIds,
  hoyActions,
  mananaActions,
  today,
  tomorrow,
  streakResult,
  bestStreak,
  upcomingTasks,
  orphanActivities,
  orphanBlocks,
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
            <OverduePanel
              trigger={
                <button
                  type="button"
                  className="focus-ring flex min-h-11 shrink-0 items-center rounded-ui border border-danger/25 bg-danger/[0.06] px-3.5 text-[13px] text-danger"
                >
                  ⚠ {overdueCount} vencida{overdueCount !== 1 ? "s" : ""}
                </button>
              }
              tasks={overdueTasks}
            />
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
                  <PlanCheckButton
                    date={b.date}
                    blockId={b.blockId}
                    isDone={false}
                    className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[13px] text-ink-dim"
                  >
                    ✓
                  </PlanCheckButton>
                  <PlanSkipButton
                    date={b.date}
                    blockId={b.blockId}
                    isSkipped={false}
                    className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[13px] text-ink-dim"
                  >
                    ✗
                  </PlanSkipButton>
                </ListCard>
              );
            })}
          </div>
        </div>
      )}

      <SecondaryCard groups={secondaryGroups} pendingActivityIds={pendingSecondaryIds} date={date} />

      <ReviewSection orphanActivities={orphanActivities} orphanBlocks={orphanBlocks} />

      <details open={morningOpen} className="overflow-hidden rounded-ui-lg border border-line bg-surface">
        <summary className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            ☀ Rutina matutina
          </span>
          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
            {morningDone} / {morningEvents.length}
          </span>
        </summary>
        <div className="flex flex-col gap-1.5 px-3.5 pb-3">
          {morningEvents.length === 0 ? (
            <EmptyState icon="☀️">Nada agendado antes de las {MORNING_END}.</EmptyState>
          ) : (
            morningEvents.map((ev) => <MobileDayRow key={ev.key} ev={ev} date={date} secondaryGroups={secondaryGroups} />)
          )}
        </div>
      </details>

      <div className="flex flex-col gap-2 rounded-ui-lg border border-accent/40 bg-accent/[0.04] p-3">
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">
            Tu día · {middayDone}/{middayEvents.length}
          </div>
          <NewTaskSheet
            action={createTask}
            date={date}
            openSignal={composeOpen}
            trigger={<button className="text-[13px] text-accent">+ Tarea</button>}
          />
        </div>
        <TodayFocusList focus={hoyActions.focus} date={today} />
        <div className="flex flex-col gap-1.5">
          {middayEvents.length === 0 ? (
            <EmptyState icon="🗒️">No tienes nada para este día todavía — agrégalo con &ldquo;+ Tarea&rdquo;.</EmptyState>
          ) : (
            <DayTimeline
              items={middayEvents.map((ev) => ({
                key: ev.key,
                start: ev.start,
                end: ev.start + ev.duration,
                done: ev.done,
                node: <MobileDayRow ev={ev} date={date} secondaryGroups={secondaryGroups} />,
              }))}
              isToday={isToday}
            />
          )}
        </div>
      </div>

      <details open={nightOpen} className="overflow-hidden rounded-ui-lg border border-line bg-surface">
        <summary className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            ☾ Rutina nocturna
          </span>
          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
            {nightDone} / {nightEvents.length}
          </span>
        </summary>
        <div className="flex flex-col gap-1.5 px-3.5 pb-3">
          {nightEvents.length === 0 ? (
            <EmptyState icon="☾">Nada agendado desde las {EVENING_START}.</EmptyState>
          ) : (
            nightEvents.map((ev) => <MobileDayRow key={ev.key} ev={ev} date={date} secondaryGroups={secondaryGroups} />)
          )}
        </div>
      </details>

      <ActionsCard
        hoy={{ date: today, ...hoyActions }}
        manana={{ date: tomorrow, ...mananaActions }}
      />

      <HabitsCard
        streak={streakResult.streak}
        best={streakResult.best}
        protectors={streakResult.protectors}
        habitsView={habitsView}
        date={date}
      />

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
              <MobileVicioRow
                key={v.id}
                v={v}
                count={viciosCounts.get(v.id) ?? 0}
                stats={vicioStatsById.get(v.id) ?? null}
                date={date}
              />
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
            <Link href="/dashboard/actividades?tiempo=semana" className="text-[11px] text-ink-dim">
              Ver todas →
            </Link>
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

function MobileVicioRow({
  v,
  count,
  stats,
  date,
}: {
  v: { id: string; name: string };
  count: number;
  stats: VicioStats | null;
  date: string;
}) {
  return (
    <ListCard>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-ink">{v.name}</span>
        <span className="block truncate text-[10.5px] text-ink-dim">
          {stats?.lastDate
            ? `${stats.daysSinceLast} día${stats.daysSinceLast === 1 ? "" : "s"} sin · mejor racha ${stats.bestStreak}`
            : "sin registros todavía"}
        </span>
      </div>
      <SafeActionButton
        action={decrementLog}
        fields={{ activityId: v.id, date }}
        disabled={count === 0}
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim disabled:opacity-30"
      >
        −
      </SafeActionButton>
      <span className="w-6 shrink-0 text-center text-[15px] font-semibold tabular-nums text-ink">{count}</span>
      <SafeActionButton
        action={incrementLog}
        fields={{ activityId: v.id, date }}
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim"
      >
        +
      </SafeActionButton>
    </ListCard>
  );
}
