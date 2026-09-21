import { and, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { loadPlanContext, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { PLAN_KINDS, kindInfo } from "@/lib/plan/kinds";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { PageHeader, Card, Progress, MetricCard, EmptyState, Badge } from "@/components/ui";

const DAYS = 30;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function PlanHistorialPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContext(userId);
  if (!ctx) {
    return (
      <div className="p-8">
        <PageHeader icon="🗺️" title="Plan · Historial" />
        <EmptyState icon="🗺️">Todavía no hay ningún plan importado.</EmptyState>
      </div>
    );
  }

  const to = todayISO();
  const from = addDaysISO(to, -(DAYS - 1));

  const planData = toPlanData(ctx);
  const days = resolvePlan(planData, from, to);

  const checks = await db
    .select()
    .from(planChecks)
    .where(and(eq(planChecks.planId, ctx.plan.id), gte(planChecks.date, from), lte(planChecks.date, to)));
  const checkByKey = new Map(checks.map((c) => [`${c.date}:${c.blockId}`, c]));

  let totalBlocks = 0;
  let totalDone = 0;
  const byKind = new Map<string, { total: number; done: number }>();
  const byPerson = new Map<string, { total: number; done: number }>();
  const perDay: {
    date: string;
    isHoliday: boolean;
    total: number;
    done: number;
    minTotal: number;
    minDone: number;
  }[] = [];
  const skippedList: { date: string; personName: string; text: string; note: string | null }[] = [];

  for (const day of days) {
    let dayTotal = 0;
    let dayDone = 0;
    let dayMinTotal = 0;
    let dayMinDone = 0;
    for (const person of ctx.people) {
      const blocks = day.blocksByPerson[person.id] ?? [];
      const pStats = byPerson.get(person.id) ?? { total: 0, done: 0 };
      for (const b of blocks) {
        const check = checkByKey.get(`${day.date}:${b.blockId}`);
        const isDone = check?.status === "done";
        dayTotal++;
        totalBlocks++;
        pStats.total++;
        if (isDone) {
          dayDone++;
          totalDone++;
          pStats.done++;
        }
        if (b.isMinimum) {
          dayMinTotal++;
          if (isDone) dayMinDone++;
        }
        const kStats = byKind.get(b.kind) ?? { total: 0, done: 0 };
        kStats.total++;
        if (isDone) kStats.done++;
        byKind.set(b.kind, kStats);

        if (check?.status === "skipped") {
          skippedList.push({ date: day.date, personName: person.name, text: check.resolvedText, note: check.note });
        }
      }
      byPerson.set(person.id, pStats);
    }
    perDay.push({ date: day.date, isHoliday: day.isHoliday, total: dayTotal, done: dayDone, minTotal: dayMinTotal, minDone: dayMinDone });
  }
  perDay.reverse(); // más reciente primero
  skippedList.reverse();

  const overallPct = totalBlocks ? Math.round((totalDone / totalBlocks) * 100) : 0;

  return (
    <div className="p-8">
      <PageHeader icon="🗺️" title="Plan · Historial" subtitle={`Últimos ${DAYS} días (${from} — ${to})`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard value={`${overallPct}%`} label="Bloques hechos" pct={overallPct} tone="accent" />
        <MetricCard value={totalDone} sub={`/ ${totalBlocks}`} label="Total hechos" tone="primary" />
        <MetricCard value={skippedList.length} label="Saltados" tone="danger" />
        <MetricCard value={ctx.people.length} label="Personas" tone="primary" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Por tipo">
          <div className="flex flex-col gap-2">
            {Object.keys(PLAN_KINDS)
              .filter((k) => byKind.has(k))
              .map((k) => {
                const s = byKind.get(k)!;
                const info = kindInfo(k);
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <Progress
                    key={k}
                    label={
                      <span className="flex items-center gap-1.5">
                        <span>{info.icon}</span> {info.label}
                      </span>
                    }
                    pct={pct}
                    value={`${s.done}/${s.total}`}
                  />
                );
              })}
          </div>
        </Card>

        <Card title="Por persona">
          <div className="flex flex-col gap-2">
            {ctx.people.map((p) => {
              const s = byPerson.get(p.id) ?? { total: 0, done: 0 };
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              return <Progress key={p.id} label={p.name} pct={pct} value={`${s.done}/${s.total}`} />;
            })}
          </div>
        </Card>
      </div>

      <Card title="Por día" flush className="mb-5">
        <div className="flex flex-col divide-y divide-line">
          {perDay.map((d) => {
            const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
            const dateLong = capitalize(
              new Date(`${d.date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
                timeZone: "America/Bogota",
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
            );
            return (
              <a
                key={d.date}
                href={`/dashboard/plan?date=${d.date}`}
                className="focus-ring-inset flex items-center gap-3 px-3.5 py-2 text-meta hover:bg-surface-2"
              >
                <span className="w-24 shrink-0 text-ink-muted">{dateLong}</span>
                {d.isHoliday && <Badge tone="warm">Festivo</Badge>}
                <Progress pct={pct} className="flex-1" />
                <span className="w-14 shrink-0 text-right tabular-nums text-ink-dim">
                  {d.done}/{d.total}
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums text-ink-dim">
                  mín {d.minDone}/{d.minTotal}
                </span>
              </a>
            );
          })}
        </div>
      </Card>

      <Card title="Saltado, con nota" count={skippedList.length}>
        {skippedList.length === 0 ? (
          <p className="text-xs text-ink-muted">No hay nada saltado en los últimos {DAYS} días.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {skippedList.map((s, i) => (
              <div key={i} className="rounded-ui bg-surface-sunken px-2.5 py-1.5 text-meta">
                <div className="flex items-center gap-2 text-ink-dim">
                  <span className="tabular-nums">{s.date}</span>
                  <span>· {s.personName}</span>
                </div>
                <div className="text-ink">{s.text}</div>
                {s.note && <div className="mt-0.5 text-ink-dim">Nota: {s.note}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
