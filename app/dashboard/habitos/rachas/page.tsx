import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { todayISO, addDaysISO, currentMonthRangeISO, BOGOTA_OFFSET } from "@/lib/date/bogota";
import { computeDailyStreak } from "@/lib/habitos/streak";
import { Table, TableHead, TableRow, EmptyState, cx, ListCard } from "@/components/ui";

function currentWeekRange(today: string) {
  const dow = new Date(`${today}T12:00:00${BOGOTA_OFFSET}`).getDay();
  const monday = addDaysISO(today, dow === 0 ? -6 : -(dow - 1));
  const sunday = addDaysISO(monday, 6);
  return { from: monday, to: sunday };
}

const COLS = "minmax(0,1fr) 110px 130px";

export default async function RachasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const today = todayISO();

  const habits = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.isActive, true)))
    .orderBy(asc(activities.frequency), asc(activities.name));

  const dailyIds = habits.filter((h) => h.frequency === "diaria").map((h) => h.id);
  const weeklyIds = habits.filter((h) => h.frequency === "semanal").map((h) => h.id);
  const monthlyIds = habits.filter((h) => h.frequency === "mensual").map((h) => h.id);

  const week = currentWeekRange(today);
  const month = currentMonthRangeISO();

  const [dailyLogs, weeklyLogs, monthlyLogs] = await Promise.all([
    dailyIds.length
      ? db
          .select({ activityId: activityLogs.activityId, date: activityLogs.date })
          .from(activityLogs)
          .where(and(eq(activityLogs.userId, userId), inArray(activityLogs.activityId, dailyIds)))
      : Promise.resolve([]),
    weeklyIds.length
      ? db
          .select({ activityId: activityLogs.activityId })
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.userId, userId),
              inArray(activityLogs.activityId, weeklyIds),
              gte(activityLogs.date, week.from),
              lte(activityLogs.date, week.to),
            ),
          )
      : Promise.resolve([]),
    monthlyIds.length
      ? db
          .select({ activityId: activityLogs.activityId })
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.userId, userId),
              inArray(activityLogs.activityId, monthlyIds),
              gte(activityLogs.date, month.from),
              lte(activityLogs.date, month.to),
            ),
          )
      : Promise.resolve([]),
  ]);

  const datesByActivity = new Map<string, string[]>();
  for (const log of dailyLogs) {
    const list = datesByActivity.get(log.activityId) ?? [];
    list.push(log.date);
    datesByActivity.set(log.activityId, list);
  }
  const doneThisWeek = new Set(weeklyLogs.map((l) => l.activityId));
  const doneThisMonth = new Set(monthlyLogs.map((l) => l.activityId));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-dim">
        Semana actual {week.from} → {week.to} · Mes actual {month.from} → {month.to}
      </p>

      {habits.length === 0 ? (
        <EmptyState icon="🔥">Sin hábitos activos. Las rachas aparecen cuando empiezas a marcar.</EmptyState>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHead cols={COLS}>
                <span>Hábito</span>
                <span>Frecuencia</span>
                <span className="text-right">Racha</span>
              </TableHead>
              {habits.map((h) => {
                const { indicator, tone } = streakIndicator(h, today, datesByActivity, doneThisWeek, doneThisMonth);
                return (
                  <TableRow key={h.id} cols={COLS}>
                    <span className="truncate text-ink">{h.name}</span>
                    <span className="text-meta text-ink-muted">{h.frequency}</span>
                    <span className={cx("text-right text-sm font-semibold", tone)}>{indicator}</span>
                  </TableRow>
                );
              })}
            </Table>
          </div>
          <div className="flex flex-col gap-1.5 md:hidden">
            {habits.map((h) => {
              const { indicator, tone } = streakIndicator(h, today, datesByActivity, doneThisWeek, doneThisMonth);
              return (
                <ListCard key={h.id}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-ink">{h.name}</div>
                    <div className="mt-0.5 text-[11px] text-ink-dim">{h.frequency}</div>
                  </div>
                  <span className={cx("shrink-0 text-[14px] font-semibold", tone)}>{indicator}</span>
                </ListCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function streakIndicator(
  h: { id: string; frequency: string },
  today: string,
  datesByActivity: Map<string, string[]>,
  doneThisWeek: Set<string>,
  doneThisMonth: Set<string>,
): { indicator: string; tone: string } {
  if (h.frequency === "diaria") {
    const streak = computeDailyStreak(datesByActivity.get(h.id) ?? [], today);
    return streak > 0
      ? { indicator: `🔥 ${streak} día${streak === 1 ? "" : "s"}`, tone: "text-accent-warm" }
      : { indicator: "—", tone: "text-ink-dim" };
  }
  if (h.frequency === "semanal") {
    const ok = doneThisWeek.has(h.id);
    return ok ? { indicator: "✓ esta semana", tone: "text-success" } : { indicator: "—", tone: "text-ink-dim" };
  }
  if (h.frequency === "mensual") {
    const ok = doneThisMonth.has(h.id);
    return ok ? { indicator: "✓ este mes", tone: "text-success" } : { indicator: "—", tone: "text-ink-dim" };
  }
  return { indicator: "∞", tone: "text-ink-dim" };
}
