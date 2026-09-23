import { and, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { loadPlanContextForUser, toPlanData } from "@/lib/plan/load";
import { resolvePlan, type ResolvedBlock } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import { todayISO, addDaysISO, diffDaysISO } from "@/lib/date/bogota";
import { Button, Card, Stepper, Badge, EmptyState, ListCard } from "@/components/ui";
import { setCheck, setOverride, removeForDay, clearOverride } from "./actions";
import { PlanBlockMenu } from "./block-menu";
import { MoveToTomorrowButton } from "./move-to-tomorrow-button";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function durationOf(b: ResolvedBlock): number {
  if (!b.endTime) return 0;
  const [sh, sm] = b.startTime.split(":").map(Number);
  const [eh, em] = b.endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const isToday = date === todayISO();

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) {
    return (
      <EmptyState icon="🗺️">
        Todavía no hay ningún plan importado. Corré <code>scripts/seed-plan.ts</code> para traer el plan de la
        casa.
      </EmptyState>
    );
  }

  const planData = toPlanData(ctx);
  const [day] = resolvePlan(planData, date, date);

  if (!day) {
    const outOfRangeBefore = date < ctx.plan.startDate;
    return (
      <>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-meta text-ink-dim">{isToday ? "Hoy" : date}</div>
          <Stepper
            prevHref={`/dashboard/plan?date=${addDaysISO(date, -1)}`}
            nextHref={`/dashboard/plan?date=${addDaysISO(date, 1)}`}
            label={isToday ? "Hoy" : date}
            current={isToday}
          />
        </div>
        <EmptyState icon="🗺️">
          {outOfRangeBefore
            ? `El plan todavía no arranca — empieza el ${ctx.plan.startDate}.`
            : `El plan ya terminó — el último día es el ${ctx.plan.endDate}.`}
          {" "}
          <a href={`/dashboard/plan?date=${outOfRangeBefore ? ctx.plan.startDate : ctx.plan.endDate}`} className="text-accent hover:underline">
            Ir a ese día →
          </a>
        </EmptyState>
      </>
    );
  }

  const checks = await db
    .select()
    .from(planChecks)
    .where(and(eq(planChecks.planId, ctx.plan.id), eq(planChecks.date, date)));
  const checkByBlockId = new Map(checks.map((c) => [c.blockId, c]));

  const overrideByBlockId = new Map(
    ctx.overrides.filter((o) => o.date === date).map((o) => [o.blockId, o]),
  );

  // Móvil ("Rutinas"): solo la columna del propio usuario — sin la grilla
  // familiar completa. `ctx.people` ya viene cargado para el día, así que
  // esto es una búsqueda en memoria, no una consulta nueva.
  const myPersonId = ctx.people.find((p) => p.userId === userId)?.id ?? null;
  const myBlocks = myPersonId ? (day.blocksByPerson[myPersonId] ?? []) : [];
  const myDoneCount = myBlocks.filter((b) => checkByBlockId.get(b.blockId)?.status === "done").length;

  // Semana X de Y dentro de la fase activa.
  let weekLabel: string | null = null;
  if (day.phase) {
    const weekIndex = Math.floor(diffDaysISO(day.phase.startDate, date) / 7) + 1;
    const totalWeeks = Math.ceil((diffDaysISO(day.phase.startDate, day.phase.endDate) + 1) / 7);
    weekLabel = `semana ${weekIndex} de ${totalWeeks}`;
  }

  // Resumen: bloques hechos, mínimos cumplidos, horas de ingresos hechas.
  let doneCount = 0;
  let totalBlocks = 0;
  let minimumsTotal = 0;
  let minimumsDone = 0;
  let incomeMinutesDone = 0;
  for (const list of Object.values(day.blocksByPerson)) {
    for (const b of list) {
      totalBlocks++;
      const check = checkByBlockId.get(b.blockId);
      if (check?.status === "done") {
        doneCount++;
        if (b.kind === "ingresos") incomeMinutesDone += durationOf(b);
      }
      if (b.isMinimum) {
        minimumsTotal++;
        if (check?.status === "done") minimumsDone++;
      }
    }
  }

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="text-meta text-ink-muted">
          {dateLong}
          {day.phase && <> · {day.phase.name}</>}
          {weekLabel && <> · {weekLabel}</>}
          {day.isHoliday && (
            <>
              {" "}
              <Badge tone="warm">Festivo</Badge>
            </>
          )}
          {day.phase?.goal && <> · {day.phase.goal}</>}
        </div>
        <div className="flex items-center gap-2">
          <Stepper
            prevHref={`/dashboard/plan?date=${addDaysISO(date, -1)}`}
            nextHref={`/dashboard/plan?date=${addDaysISO(date, 1)}`}
            label={isToday ? "Hoy" : date}
            current={isToday}
          />
          {!isToday && (
            <Button variant="secondary" href={`/dashboard/plan?date=${todayISO()}`}>
              Hoy
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[160px]">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-dim">Bloques hechos</div>
          <div className="mt-1 font-display text-[21px] font-bold text-ink">
            {doneCount}
            <span className="text-body font-normal text-ink-dim"> / {totalBlocks}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-[160px]">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-dim">Mínimos cumplidos</div>
          <div className="mt-1 font-display text-[21px] font-bold text-ink">
            {minimumsDone}
            <span className="text-body font-normal text-ink-dim"> / {minimumsTotal}</span>
          </div>
        </Card>
        <Card className="flex-1 min-w-[160px]">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-dim">Horas de ingresos hechas</div>
          <div className="mt-1 font-display text-[21px] font-bold text-ink">{fmtDur(incomeMinutesDone)}</div>
        </Card>
      </div>

      {day.events.length > 0 && (
        <Card title="Eventos del día" className="mb-4">
          <div className="flex flex-col gap-1.5">
            {day.events.map((e) => {
              const person = e.personId ? ctx.people.find((p) => p.id === e.personId) : null;
              return (
                <div key={e.eventId} className="flex items-center gap-2 text-meta">
                  {e.startTime && <span className="tabular-nums text-ink-dim">{e.startTime}</span>}
                  <span className="text-ink">{e.text}</span>
                  {person && <span className="text-ink-dim">· {person.name}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2 md:hidden">
        {myBlocks.length === 0 ? (
          <EmptyState icon="🗺️">Nada agendado este día para vos.</EmptyState>
        ) : (
          <>
            <div className="flex items-center justify-between text-[11px] text-ink-dim">
              <span>Bloques</span>
              <span>
                {myDoneCount} / {myBlocks.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {myBlocks.map((b) => {
                const check = checkByBlockId.get(b.blockId);
                const kind = kindInfo(b.kind);
                const isDone = check?.status === "done";
                return (
                  <div key={b.blockId} className="flex items-center gap-2">
                    <form action={setCheck} className="min-w-0 flex-1">
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="blockId" value={b.blockId} />
                      <input type="hidden" name="status" value={isDone ? "" : "done"} />
                      <button type="submit" className="contents">
                        <ListCard accent={kind.color}>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
                              isDone ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="w-11 shrink-0 text-[11px] tabular-nums text-ink-dim">{b.startTime}</span>
                          <span className="shrink-0 text-[16px]">{kind.icon}</span>
                          <span
                            className={`line-clamp-2 min-w-0 flex-1 text-[15px] ${isDone ? "text-ink-dim line-through" : "text-ink"}`}
                          >
                            {b.text}
                          </span>
                          {b.isMinimum && <Badge tone="warm" className="shrink-0">Mínimo</Badge>}
                        </ListCard>
                      </button>
                    </form>
                    <PlanBlockMenu date={date} blockId={b.blockId} startTime={b.startTime} text={b.text} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="hidden gap-4 md:grid" style={{ gridTemplateColumns: `repeat(${ctx.people.length}, minmax(0,1fr))` }}>
        {ctx.people.map((person) => {
          const blocks = day.blocksByPerson[person.id] ?? [];
          return (
            <Card key={person.id} title={person.name} count={blocks.length} flush>
              <div className="flex flex-col divide-y divide-line">
                {blocks.length === 0 && (
                  <p className="px-3.5 py-4 text-xs text-ink-muted">Nada agendado este día.</p>
                )}
                {blocks.map((b) => {
                  const check = checkByBlockId.get(b.blockId);
                  const override = overrideByBlockId.get(b.blockId);
                  const kind = kindInfo(b.kind);
                  const isDone = check?.status === "done";
                  const isSkipped = check?.status === "skipped";
                  return (
                    <div key={b.blockId} className="px-3.5 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 pt-0.5 text-meta">{kind.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-meta text-ink-dim">
                            <span className="tabular-nums">
                              {b.startTime}
                              {b.endTime && `–${b.endTime}`}
                            </span>
                            <span style={{ color: kind.color }}>{kind.label}</span>
                            {b.isMinimum && <Badge tone="warm">Mínimo</Badge>}
                            {b.tentative && <Badge tone="neutral">Tentativo</Badge>}
                            {b.isHoliday && <Badge tone="accent">Festivo</Badge>}
                            {override && <Badge tone="neutral">Editado hoy</Badge>}
                          </div>
                          <div className={isDone ? "text-body text-ink-dim line-through" : "text-body text-ink"}>
                            {b.text}
                          </div>
                          {check?.note && <div className="mt-0.5 text-meta text-ink-dim">Nota: {check.note}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <form action={setCheck}>
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="blockId" value={b.blockId} />
                            <input type="hidden" name="status" value={isDone ? "" : "done"} />
                            <button
                              type="submit"
                              title="Hecho"
                              className={
                                "focus-ring rounded-ui border px-1.5 py-1 text-[11px] transition-colors duration-120 " +
                                (isDone
                                  ? "border-success/40 bg-success/12 text-success"
                                  : "border-line text-ink-dim hover:border-line-strong hover:text-ink")
                              }
                            >
                              ✓
                            </button>
                          </form>
                          <form action={setCheck}>
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="blockId" value={b.blockId} />
                            <input type="hidden" name="status" value={isSkipped ? "" : "skipped"} />
                            <button
                              type="submit"
                              title="Saltado"
                              className={
                                "focus-ring rounded-ui border px-1.5 py-1 text-[11px] transition-colors duration-120 " +
                                (isSkipped
                                  ? "border-danger/40 bg-danger/12 text-danger"
                                  : "border-line text-ink-dim hover:border-line-strong hover:text-ink")
                              }
                            >
                              ✗
                            </button>
                          </form>
                        </div>
                      </div>

                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">
                          Cambiar solo hoy
                        </summary>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <form action={setOverride} className="flex flex-1 min-w-[180px] items-center gap-1.5">
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="blockId" value={b.blockId} />
                            <input
                              type="text"
                              name="text"
                              defaultValue={override?.text ?? b.text}
                              className="min-w-0 flex-1 rounded-ui border border-line bg-canvas px-2 py-1 text-meta text-ink"
                            />
                            <Button type="submit" variant="secondary" size="sm">
                              Guardar
                            </Button>
                          </form>
                          <form action={setCheck} className="flex items-center gap-1.5">
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="blockId" value={b.blockId} />
                            <input type="hidden" name="status" value={check?.status || "done"} />
                            <input
                              type="text"
                              name="note"
                              defaultValue={check?.note ?? ""}
                              placeholder="Nota — ¿qué hiciste?"
                              className="min-w-0 flex-1 rounded-ui border border-line bg-canvas px-2 py-1 text-meta text-ink"
                            />
                            <Button type="submit" variant="secondary" size="sm">
                              Nota
                            </Button>
                          </form>
                          <MoveToTomorrowButton date={date} blockId={b.blockId} text={b.text} />
                          <form action={removeForDay}>
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="blockId" value={b.blockId} />
                            <Button type="submit" variant="danger" size="sm">
                              Quitar hoy
                            </Button>
                          </form>
                          {override && (
                            <form action={clearOverride}>
                              <input type="hidden" name="date" value={date} />
                              <input type="hidden" name="blockId" value={b.blockId} />
                              <Button type="submit" variant="secondary" size="sm">
                                Deshacer
                              </Button>
                            </form>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
