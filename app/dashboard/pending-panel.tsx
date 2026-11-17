"use client";

import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui";
import type { AgendaEvent } from "@/lib/agenda/day-events";
import { DayEventRow } from "./day-event-row";

// Panel de "Pendientes" — mismas filas y acciones que "Tu día" (✓, ✗ de
// Plan, mover/editar vía los menús "⋯" ya existentes), filtradas a lo que
// falta por hacer hoy. Mismo patrón de overlay que <QuickAddPanel>.
export function PendingPanel({
  trigger,
  events,
  date,
}: {
  trigger: ReactNode;
  events: AgendaEvent[];
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const pending = events.filter((e) => !e.done);

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="mt-[8vh] w-full max-w-md overflow-hidden rounded-ui-lg border border-line-strong bg-surface-2"
          >
            <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-3">
              <span className="font-display text-[15px] font-semibold text-ink">Pendientes de hoy</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-ui px-2 py-1 text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto">
              {pending.length === 0 ? (
                <EmptyState icon="🎉">Todo lo de hoy está hecho.</EmptyState>
              ) : (
                pending.map((ev) => <DayEventRow key={ev.key} ev={ev} date={date} />)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
