import type { ResolvedBlock, ResolvedEvent } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import { BlockIcon } from "@/lib/icons/habit-icons";
import { planCardWrapperClass } from "@/lib/plan/block-style";
import { PlanCheckButton, PlanSkipButton } from "./block-check";
import { PlanBlockMenu } from "./block-menu";
import { Badge, EmptyState } from "@/components/ui";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// El día de las OTRAS personas del plan (ej. Diana, además de quien está
// logueado) — solo existía en la vista de día de /dashboard/plan (la
// grilla con una columna por persona), que ya no tiene ruta propia; Tu día
// (page.tsx) es por diseño de UNA sola persona (la logueada), así que esto
// se agrega como una sección aparte, colapsable, para no perder la
// capacidad de ver/marcar el plan de la casa completo desde el dashboard.
export function HouseholdPlanSection({
  people,
  blocksByPerson,
  checkByBlockId,
  date,
}: {
  people: { id: string; name: string }[];
  blocksByPerson: Record<string, ResolvedBlock[]>;
  checkByBlockId: Map<string, { status: string; note: string | null }>;
  date: string;
}) {
  if (people.length === 0) return null;

  return (
    <details className="overflow-hidden rounded-ui-lg border border-line bg-surface">
      <summary className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Plan de la casa
        </span>
      </summary>
      <div className="grid gap-3 p-3.5 md:grid-cols-2">
        {people.map((person) => {
          const blocks = [...(blocksByPerson[person.id] ?? [])].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
          return (
            <div key={person.id} className="flex flex-col gap-1.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{person.name}</div>
              {blocks.length === 0 ? (
                <EmptyState icon="🗺️">Nada agendado este día.</EmptyState>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {blocks.map((b) => {
                    const check = checkByBlockId.get(b.blockId);
                    const kind = kindInfo(b.kind);
                    const isDone = check?.status === "done";
                    const isSkipped = check?.status === "skipped";
                    return (
                      <div key={b.blockId} className={`rounded-ui border px-2.5 py-2 ${planCardWrapperClass(isDone)}`}>
                        <div className="flex items-start gap-2">
                          <BlockIcon kind={b.kind} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[10.5px] text-ink-dim">
                              <span className="tabular-nums">
                                {b.startTime}
                                {b.endTime && `–${b.endTime}`}
                              </span>
                              <span style={{ color: kind.color }}>{kind.label}</span>
                              {b.isMinimum && <Badge tone="warm">Mínimo</Badge>}
                            </div>
                            <div className={`text-[13px] ${isDone ? "text-ink-dim line-through" : "text-ink"}`}>{b.text}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <PlanCheckButton
                              date={date}
                              blockId={b.blockId}
                              isDone={isDone}
                              className={`focus-ring rounded-ui border px-1.5 py-1 text-[11px] ${
                                isDone ? "border-success/40 bg-success/12 text-success" : "border-line text-ink-dim"
                              }`}
                            >
                              ✓
                            </PlanCheckButton>
                            <PlanSkipButton
                              date={date}
                              blockId={b.blockId}
                              isSkipped={isSkipped}
                              className={`focus-ring rounded-ui border px-1.5 py-1 text-[11px] ${
                                isSkipped ? "border-danger/40 bg-danger/12 text-danger" : "border-line text-ink-dim"
                              }`}
                            >
                              ✗
                            </PlanSkipButton>
                            <PlanBlockMenu
                              date={date}
                              blockId={b.blockId}
                              startTime={b.startTime}
                              text={b.text}
                              triggerClassName="focus-ring rounded-ui border border-line px-1.5 py-1 text-[11px] text-ink-dim"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

// "Eventos del día" (plan_events — cumpleaños, etc., ver scripts/seed-
// plan.ts) — solo se mostraba en la vista de día de /dashboard/plan.
export function PlanDayEventsCard({
  events,
  people,
}: {
  events: ResolvedEvent[];
  people: { id: string; name: string }[];
}) {
  if (events.length === 0) return null;
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-1.5 rounded-ui-lg border border-accent-warm/25 bg-accent-warm/[0.04] px-3.5 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-warm">Eventos del día</div>
      {events.map((e) => (
        <div key={e.eventId} className="flex items-center gap-2 text-[13px]">
          {e.startTime && <span className="tabular-nums text-ink-dim">{e.startTime}</span>}
          <span className="text-ink">{e.text}</span>
          {e.personId && nameById.get(e.personId) && <span className="text-ink-dim">· {nameById.get(e.personId)}</span>}
        </div>
      ))}
    </div>
  );
}
