"use client";

import { type ReactNode, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { PendingMinimumBlock, PendingSecondaryHabit } from "@/lib/plan/pending";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import { DeferButton } from "./plan/defer-button";
import { CounterControls } from "./plan/counter-controls";
import { HabitIcon } from "@/lib/icons/habit-icons";

// Panel de "Pendientes" — mínimos vencidos (is_minimum, sin marcar) y,
// aparte, hábitos/subhábitos SECUNDARIOS (is_optional=true) cuya hora ya
// pasó y tampoco están marcados. Los secundarios no afectan racha ni el
// contador principal — son solo un recordatorio con su propio conteo.
// Mismo patrón de overlay que <QuickAddPanel>.
export function PendingPanel({
  trigger,
  pendingMinimums,
  pendingSecondary,
  date,
}: {
  trigger: ReactNode;
  pendingMinimums: PendingMinimumBlock[];
  pendingSecondary: PendingSecondaryHabit[];
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  // Estado local solo para el valor del contador (ver CounterControls) —
  // se refleja al toque, sin esperar a que revalidatePath (dentro de
  // adjustCounter) traiga la lista nueva del servidor. El resto de la
  // lista (quién sigue pendiente) sí depende de esa revalidación, igual
  // que antes.
  const [secondaryView, setSecondaryView] = useState(pendingSecondary);
  useEffect(() => {
    setSecondaryView(pendingSecondary);
  }, [pendingSecondary]);

  function onHabitResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

  function onCounterChanged(activityId: string, value: number, done: boolean, toastMessage: string | null) {
    setSecondaryView((list) => list.map((h) => (h.activityId === activityId ? { ...h, currentValue: value } : h)));
    if (toastMessage) toast.show({ message: toastMessage, tone: "success" });
  }

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
              <span className="font-display text-[15px] font-semibold text-ink">Mínimos vencidos</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-ui px-2 py-1 text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[70vh] flex-col overflow-y-auto">
              <div className="flex flex-col divide-y divide-line">
                {pendingMinimums.length === 0 ? (
                  <EmptyState icon="🎉">No hay mínimos vencidos sin marcar.</EmptyState>
                ) : (
                  pendingMinimums.map((p) => (
                    <a
                      key={p.blockId}
                      href={`/dashboard/plan?date=${p.effectiveDate}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-surface-2"
                    >
                      <span className="w-14 shrink-0 text-meta tabular-nums text-ink-dim">{p.dueTime}</span>
                      <span className="min-w-0 flex-1 truncate text-body text-ink">{p.text}</span>
                    </a>
                  ))
                )}
              </div>

              {secondaryView.length > 0 && (
                <div className="border-t border-line">
                  <div className="bg-surface px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    Secundarios pendientes
                  </div>
                  <div className="flex flex-col divide-y divide-line">
                    {secondaryView.map((h) =>
                      h.targetValue != null ? (
                        <div key={h.activityId} className="flex flex-col gap-1.5 px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <HabitIcon icon={h.icon} className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
                            <span className="w-12 shrink-0 text-meta tabular-nums text-ink-dim">{h.dueTime}</span>
                            <span className="min-w-0 flex-1 truncate text-body text-ink">
                              {h.name}
                              <span className="ml-1.5 text-meta text-ink-dim">· {h.blockText}</span>
                            </span>
                            <span className="shrink-0 text-meta tabular-nums text-ink-dim">
                              {h.currentValue}/{h.targetValue}
                              {h.unit ? ` ${h.unit}` : ""}
                            </span>
                            <DeferButton date={date} blockId={h.blockId} text={h.blockText} startTime={h.blockStartTime} />
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.min(100, (h.currentValue / h.targetValue) * 100)}%` }}
                            />
                          </div>
                          <CounterControls
                            activityId={h.activityId}
                            countSteps={h.countSteps}
                            date={date}
                            onChanged={onCounterChanged}
                          />
                        </div>
                      ) : (
                        <div key={h.activityId} className="flex items-center gap-2 px-3.5 py-2.5">
                          <SafeActionButton
                            action={toggleLogToday}
                            fields={{ activityId: h.activityId, date }}
                            onResult={onHabitResult}
                            className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-ui py-0.5 text-left transition-colors duration-120 hover:bg-surface"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-ui border border-line-strong text-[11px] text-transparent">
                              ✓
                            </span>
                            <span className="w-12 shrink-0 text-meta tabular-nums text-ink-dim">{h.dueTime}</span>
                            <span className="min-w-0 flex-1 truncate text-body text-ink">
                              {h.name}
                              <span className="ml-1.5 text-meta text-ink-dim">· {h.blockText}</span>
                            </span>
                          </SafeActionButton>
                          <DeferButton date={date} blockId={h.blockId} text={h.blockText} startTime={h.blockStartTime} />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
