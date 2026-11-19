import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks, plans } from "@/lib/db/schema/plan";
import { loadPlanContextForUser, toPlanData } from "@/lib/plan/load";
import { resolvePlan, type ResolvedBlock } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import { todayISO, addDaysISO, diffDaysISO, nowHHMM } from "@/lib/date/bogota";
import { getPendingMinimumsForPerson } from "@/lib/plan/pending";
import { loadHabitTreesByBlock } from "@/lib/plan/sub-habits";
import { Button, Card, Stepper, Badge, EmptyState, ListCard } from "@/components/ui";
import { setOverride, removeForDay, clearOverride } from "./actions";
import { PlanBlockMenu } from "./block-menu";
import { DeferButton } from "./defer-button";
import { MoveBlockButtons } from "./move-to-tomorrow-button";
import { ResetPlanStartButton } from "./reset-plan-start-button";
import { PlanCheckButton, PlanSkipButton, SubHabitsDropdown } from "./block-check";
import { NoteForm } from "./note-form";
import { DayTimeline } from "../day-timeline";
import { fmtDuration } from "@/lib/agenda/time";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function durationOf(b: ResolvedBlock): number {
  if (!b.endTime) return 0;
  const [sh, sm] = b.startTime.split(":").map(Number);
  const [eh, em] = b.endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

// Para la línea de tiempo (huecos, solapamiento, "ahora"): un bloque
// abierto (sin endTime, ej. Dormir) no tiene fin acotado — se le da
// duración 0 solo para este cálculo, para no inventar un hueco ocupado.
function timelineEnd(b: ResolvedBlock): number {
  return toMinutes(b.startTime) + (b.endTime ? durationOf(b) : 0);
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
  const isOwner = !!ctx && (await db.select({ ownerId: plans.ownerId }).from(plans).where(eq(plans.id, ctx.plan.id)))[0]?.ownerId === userId;
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
        {isOwner && (
          <div className="mt-3">
            <ResetPlanStartButton planId={ctx.plan.id} />
          </div>
        )}
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

  // Árbol de hábitos por bloque (hasta 3 niveles) — TODOS los de primer
  // nivel, incluido el que comparte nombre con el bloque (ver
  // lib/plan/sub-habits.ts).
  const habitTreesByBlock = await loadHabitTreesByBlock(ctx.plan.id, userId, date);

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

  // Resumen: bloques hechos, mínimos cumplidos, horas de ingresos hechas,
  // mínimos pendientes (ya les tocó pasar y no tienen check).
  const today = todayISO();
  const now = nowHHMM();
  let doneCount = 0;
  let totalBlocks = 0;
  let minimumsTotal = 0;
  let minimumsDone = 0;
  let incomeMinutesDone = 0;
  for (const person of ctx.people) {
    const list = day.blocksByPerson[person.id] ?? [];
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
  const showPersonName = ctx.people.length > 1;

  // Pendientes "de verdad": solo mínimos cuya hora de vencimiento ya pasó
  // (ver lib/plan/pending.ts — incluye el caso de bloques que cruzan
  // medianoche, ej. Dormir, que vencen al día siguiente). Solo tiene
  // sentido para HOY — un día pasado ya está todo "vencido" sin más (se
  // muestra cualquier mínimo sin marcar), un día futuro no tiene nada
  // vencido todavía.
  const pendingMinimums: { blockId: string; personName: string; text: string; startTime: string; dueTime: string }[] = [];
  if (date === today) {
    for (const person of ctx.people) {
      const list = await getPendingMinimumsForPerson(ctx, person.id, today, now);
      for (const p of list) {
        pendingMinimums.push({ blockId: p.blockId, personName: person.name, text: p.text, startTime: p.startTime, dueTime: p.dueTime });
      }
    }
  } else if (date < today) {
    for (const person of ctx.people) {
      const list = day.blocksByPerson[person.id] ?? [];
      for (const b of list) {
        const check = checkByBlockId.get(b.blockId);
        if (b.isMinimum && !check) {
          pendingMinimums.push({
            blockId: b.blockId,
            personName: person.name,
            text: b.text,
            startTime: b.startTime,
            dueTime: b.endTime ?? b.startTime,
          });
        }
      }
    }
  }
  pendingMinimums.sort((a, b) => a.dueTime.localeCompare(b.dueTime));

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
          {isOwner && <ResetPlanStartButton planId={ctx.plan.id} />}
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
        <Card className={`flex-1 min-w-[160px] ${pendingMinimums.length > 0 ? "border-danger/25 bg-danger/[0.04]" : ""}`}>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-dim">Pendientes</div>
          <div className="mt-1 font-display text-[21px] font-bold text-ink">{pendingMinimums.length}</div>
        </Card>
      </div>

      {pendingMinimums.length > 0 && (
        <Card title="Pendientes" count={pendingMinimums.length} className="mb-4 border-danger/25 bg-danger/[0.04]">
          <p className="mb-2.5 text-meta text-ink-dim">Mínimos cuya hora ya pasó y todavía no se marcaron.</p>
          <div className="flex flex-col gap-1.5">
            {pendingMinimums.map((p) => (
              <div key={p.blockId} className="flex items-center gap-2.5 rounded-ui bg-surface-sunken px-2.5 py-1.5 text-meta">
                <span className="shrink-0 tabular-nums text-ink-dim">
                  {p.startTime}
                  {p.dueTime !== p.startTime && ` → ${p.dueTime}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.text}</span>
                {showPersonName && <span className="shrink-0 text-ink-dim">{p.personName}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

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
              <DayTimeline
                isToday={isToday}
                items={myBlocks.map((b) => {
                  const check = checkByBlockId.get(b.blockId);
                  const kind = kindInfo(b.kind);
                  const isDone = check?.status === "done";
                  const subHabits = habitTreesByBlock.get(b.blockId) ?? [];
                  return {
                    key: b.blockId,
                    start: toMinutes(b.startTime),
                    end: timelineEnd(b),
                    done: isDone,
                    node: (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <PlanCheckButton date={date} blockId={b.blockId} isDone={isDone} className="contents min-w-0 flex-1">
                            <ListCard accent={kind.color}>
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
                                  isDone ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                              <div className="flex w-14 shrink-0 flex-col items-start leading-tight">
                                <span className="text-[11px] tabular-nums text-ink-dim">
                                  {b.startTime}
                                  {b.endTime && `–${b.endTime}`}
                                </span>
                                {b.endTime && (
                                  <span className="text-[9px] tabular-nums text-ink-dim/70">{fmtDuration(durationOf(b))}</span>
                                )}
                              </div>
                              <span className="shrink-0 text-[16px]">{kind.icon}</span>
                              <span
                                className={`line-clamp-2 min-w-0 flex-1 text-[15px] ${isDone ? "text-ink-dim line-through" : "text-ink"}`}
                              >
                                {b.text}
                              </span>
                              {b.isMinimum && <Badge tone="warm" className="shrink-0">Mínimo</Badge>}
                            </ListCard>
                          </PlanCheckButton>
                          <PlanBlockMenu date={date} blockId={b.blockId} startTime={b.startTime} text={b.text} />
                          <DeferButton date={date} blockId={b.blockId} text={b.text} startTime={b.startTime} />
                        </div>
                        {subHabits.length > 0 && (
                          <div className="pl-2">
                            <SubHabitsDropdown date={date} blockId={b.blockId} subHabits={subHabits} />
                          </div>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            </div>
          </>
        )}
      </div>

      <div className="hidden gap-4 md:grid" style={{ gridTemplateColumns: `repeat(${ctx.people.length}, minmax(0,1fr))` }}>
        {ctx.people.map((person) => {
          const blocks = day.blocksByPerson[person.id] ?? [];
          return (
            <Card key={person.id} title={person.name} count={blocks.length} flush>
              <div className="flex flex-col gap-2.5 p-2.5">
                {blocks.length === 0 && (
                  <p className="px-1 py-4 text-xs text-ink-muted">Nada agendado este día.</p>
                )}
                <DayTimeline
                  isToday={isToday}
                  items={blocks.map((b) => {
                    const check = checkByBlockId.get(b.blockId);
                    const override = overrideByBlockId.get(b.blockId);
                    const kind = kindInfo(b.kind);
                    const isDone = check?.status === "done";
                    const isSkipped = check?.status === "skipped";
                    const subHabits = habitTreesByBlock.get(b.blockId) ?? [];
                    return {
                      key: b.blockId,
                      start: toMinutes(b.startTime),
                      end: timelineEnd(b),
                      done: isDone,
                      node: (
                    <div className="rounded-ui-lg border border-line bg-surface px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 pt-0.5 text-meta">{kind.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-meta text-ink-dim">
                            <span className="tabular-nums">
                              {b.startTime}
                              {b.endTime && `–${b.endTime}`}
                            </span>
                            {b.endTime && <span className="text-[10.5px] text-ink-dim/70">· {fmtDuration(durationOf(b))}</span>}
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
                          <PlanCheckButton
                            date={date}
                            blockId={b.blockId}
                            isDone={isDone}
                            className={
                              "focus-ring rounded-ui border px-1.5 py-1 text-[11px] transition-colors duration-120 " +
                              (isDone
                                ? "border-success/40 bg-success/12 text-success"
                                : "border-line text-ink-dim hover:border-line-strong hover:text-ink")
                            }
                          >
                            <span title="Hecho">✓</span>
                          </PlanCheckButton>
                          <PlanSkipButton
                            date={date}
                            blockId={b.blockId}
                            isSkipped={isSkipped}
                            className={
                              "focus-ring rounded-ui border px-1.5 py-1 text-[11px] transition-colors duration-120 " +
                              (isSkipped
                                ? "border-danger/40 bg-danger/12 text-danger"
                                : "border-line text-ink-dim hover:border-line-strong hover:text-ink")
                            }
                          >
                            <span title="Saltado">✗</span>
                          </PlanSkipButton>
                          <DeferButton
                            date={date}
                            blockId={b.blockId}
                            text={b.text}
                            startTime={b.startTime}
                            className="focus-ring rounded-ui border border-line px-1.5 py-1 text-[11px] text-ink-dim transition-colors duration-120 hover:border-line-strong hover:text-ink"
                          />
                        </div>
                      </div>

                      {subHabits.length > 0 && <SubHabitsDropdown date={date} blockId={b.blockId} subHabits={subHabits} />}

                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">
                          Cambiar solo hoy
                        </summary>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <a href={`/dashboard/plan/bloque/${b.blockId}`} className="text-[10.5px] text-accent hover:underline">
                            Abrir página del bloque →
                          </a>
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
                          <NoteForm
                            date={date}
                            blockId={b.blockId}
                            currentStatus={check?.status}
                            defaultNote={check?.note ?? ""}
                          />
                          <MoveBlockButtons date={date} blockId={b.blockId} text={b.text} />
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
                      ),
                    };
                  })}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
