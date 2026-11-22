"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui";
import type { AgendaEvent } from "@/lib/agenda/day-events";
import { fmtTime } from "@/lib/agenda/time";
import { MORNING_END_MIN, EVENING_START_MIN } from "@/lib/agenda/day-sections";
import { primaryActionFor } from "@/lib/plan/primary-action";
import { BlockIcon } from "@/lib/icons/habit-icons";
import { BottomSheetModal } from "./compact-modal-card";
import { SafeActionButton } from "./safe-action-button";
import { CounterControls } from "./plan/counter-controls";
import { DeferButton } from "./plan/defer-button";
import { cascadeDoneInGroups, countTotals, updateValueInGroups, SecondaryGroupEntry } from "./secondary-section";
import type { SecondaryBand, SecondaryEntry } from "@/lib/plan/secondary-bands";

// Una fila pendiente de "Tu día" (hábito/tarea/cita/bloque de Plan) dentro
// del modal — mismo primaryActionFor + SafeActionButton que day-event-
// row.tsx/mobile-day-row.tsx (el mismo toggle/cascada), solo con un
// layout más chico pensado para una lista larga en un modal, no la fila
// completa con menú ⋯/árbol desplegable de Tu día. Un hábito con meta
// (ev.targetValue) muestra el mismo contador que en el árbol del Plan y
// en Secundarios (CounterControls/adjustCounter), con su propio checkbox
// de marcar directo al lado, igual que allá.
function PendingEventRow({
  ev,
  date,
  onToggled,
  onCounterChanged,
}: {
  ev: AgendaEvent;
  date: string;
  onToggled: (key: string, done: boolean) => void;
  onCounterChanged: (key: string, value: number, done: boolean) => void;
}) {
  const toast = useToast();
  const primary = primaryActionFor(ev, date);

  function onResult(result: unknown) {
    onToggled(ev.key, !ev.done);
    if (result && typeof result === "object" && "toastMessage" in result) {
      const r = result as { toastMessage: string | null };
      if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
    }
  }

  function onCounterResult(_activityId: string, value: number, done: boolean, toastMessage: string | null) {
    onCounterChanged(ev.key, value, done);
    if (toastMessage) toast.show({ message: toastMessage, tone: "success" });
  }

  const timeLabel = ev.flexible ? "cuando lo hagas" : ev.autoTime ? "sin hora" : fmtTime(ev.start);

  return (
    <div className="flex items-center gap-2.5 rounded-ui border border-line bg-surface px-2.5 py-2">
      <span className="w-[72px] shrink-0 text-[11px] tabular-nums text-ink-dim">{timeLabel}</span>
      {ev.kind === "plan" ? (
        <BlockIcon kind={ev.planKind ?? null} className="h-4 w-4 shrink-0 text-ink-dim" />
      ) : (
        <span className="shrink-0 text-[15px]">{ev.icon}</span>
      )}
      {ev.targetValue != null ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {primary && (
              <SafeActionButton
                action={primary.action}
                fields={primary.fields}
                onResult={onResult}
                className="focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border border-line-strong text-[10px] text-transparent"
              >
                ✓
              </SafeActionButton>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{ev.title}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
              {ev.currentValue ?? 0}/{ev.targetValue}
              {ev.unit ? ` ${ev.unit}` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, ((ev.currentValue ?? 0) / ev.targetValue) * 100)}%` }}
            />
          </div>
          <CounterControls
            activityId={ev.itemId ?? ev.refId}
            countSteps={ev.countSteps ?? null}
            date={date}
            onChanged={onCounterResult}
          />
        </div>
      ) : primary ? (
        <SafeActionButton
          action={primary.action}
          fields={primary.fields}
          onResult={onResult}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-ui py-0.5 text-left transition-colors duration-120 hover:bg-surface-2"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border border-line-strong text-[10px] text-transparent">
            ✓
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{ev.title}</span>
        </SafeActionButton>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{ev.title}</span>
      )}
      {ev.kind === "plan" && <DeferButton date={date} blockId={ev.refId} text={ev.title} startTime={fmtTime(ev.start)} />}
    </div>
  );
}

function EventGroup({
  title,
  events,
  date,
  onToggled,
  onCounterChanged,
}: {
  title: string;
  events: AgendaEvent[];
  date: string;
  onToggled: (key: string, done: boolean) => void;
  onCounterChanged: (key: string, value: number, done: boolean) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{title}</div>
      <div className="flex flex-col gap-1.5">
        {events.map((ev) => (
          <PendingEventRow key={ev.key} ev={ev} date={date} onToggled={onToggled} onCounterChanged={onCounterChanged} />
        ))}
      </div>
    </div>
  );
}

// Tarjeta "Progreso del día" del encabezado — al tocarla abre este modal
// (BottomSheetModal, se apila igual que cualquier otro) con TODO lo que
// falta hoy: Rutina matutina / Tu día / Rutina nocturna (mismas 3
// secciones y mismos `events` que ya arma buildDayEvents — ver page.tsx,
// nada de lógica de conteo nueva, solo se filtra a lo no-done y se
// reparte por hora igual que el resto del dashboard) y, abajo, un cuarto
// grupo "Secundarios" (secondaryGroups, la misma data de SecondaryCard,
// filtrada a lo no-done). El resumen de arriba y la barra del encabezado
// se recalculan en vivo sobre la MISMA lista `events` (con el estado
// optimista local de este modal) con la fórmula trivial de siempre
// (done.length / total.length) — no una regla de conteo distinta.
export function DayProgressPanel({
  trigger,
  events: initialEvents,
  secondaryGroups: initialSecondaryGroups,
  date,
}: {
  trigger: ReactNode;
  events: AgendaEvent[];
  secondaryGroups: Record<SecondaryBand, SecondaryEntry[]>;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [events, setEvents] = useState(initialEvents);
  useEffect(() => setEvents(initialEvents), [initialEvents]);
  const [secondaryGroups, setSecondaryGroups] = useState(initialSecondaryGroups);
  useEffect(() => setSecondaryGroups(initialSecondaryGroups), [initialSecondaryGroups]);

  function onToggled(key: string, done: boolean) {
    setEvents((list) => list.map((e) => (e.key === key ? { ...e, done } : e)));
  }
  function onCounterChanged(key: string, value: number, done: boolean) {
    setEvents((list) => list.map((e) => (e.key === key ? { ...e, currentValue: value, done } : e)));
  }
  function onSecondaryToggled(activityId: string, done: boolean) {
    setSecondaryGroups((g) => cascadeDoneInGroups(g, activityId, done));
  }
  function onSecondaryCounterChanged(activityId: string, value: number, done: boolean) {
    setSecondaryGroups((g) => cascadeDoneInGroups(updateValueInGroups(g, activityId, value), activityId, done));
  }

  const doneToday = events.filter((e) => e.done).length;
  const totalToday = events.length;
  const pctToday = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  const pending = events.filter((e) => !e.done).sort((a, b) => a.start - b.start);
  const morning = pending.filter((e) => e.start < MORNING_END_MIN);
  const midday = pending.filter((e) => e.start >= MORNING_END_MIN && e.start < EVENING_START_MIN);
  const night = pending.filter((e) => e.start >= EVENING_START_MIN);

  const pendingSecondary = [...secondaryGroups.manana, ...secondaryGroups.tarde, ...secondaryGroups.noche]
    .filter((e) => !e.node.done)
    .sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const nothingPending = pending.length === 0 && pendingSecondary.length === 0;
  const { total: secondaryTotal } = countTotals(secondaryGroups);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="focus-ring block w-full text-left">
        {trigger}
      </button>
      <BottomSheetModal open={open} onOpenChange={setOpen} title="Progreso del día" returnFocusRef={triggerRef}>
        <div className="flex flex-col gap-3 p-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-meta text-ink-muted">
              <span>Progreso del día</span>
              <span className="font-semibold text-accent">
                {doneToday} / {totalToday} · {pctToday}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pctToday}%` }} />
            </div>
          </div>

          {nothingPending ? (
            <EmptyState icon="🎉">¡Día completo! No queda nada pendiente, ni secundarios.</EmptyState>
          ) : (
            <>
              <EventGroup
                title="☀ Rutina matutina"
                events={morning}
                date={date}
                onToggled={onToggled}
                onCounterChanged={onCounterChanged}
              />
              <EventGroup
                title="Tu día (acciones y tareas)"
                events={midday}
                date={date}
                onToggled={onToggled}
                onCounterChanged={onCounterChanged}
              />
              <EventGroup
                title="☾ Rutina nocturna"
                events={night}
                date={date}
                onToggled={onToggled}
                onCounterChanged={onCounterChanged}
              />
              {pendingSecondary.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    Secundarios · {secondaryTotal - pendingSecondary.length}/{secondaryTotal}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {pendingSecondary.map((entry) => (
                      <SecondaryGroupEntry
                        key={entry.node.activityId}
                        entry={entry}
                        date={date}
                        onToggled={onSecondaryToggled}
                        onCounterChanged={onSecondaryCounterChanged}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </BottomSheetModal>
    </>
  );
}
