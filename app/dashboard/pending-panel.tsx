"use client";

import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { PendingMinimumBlock, PendingSecondaryHabit } from "@/lib/plan/pending";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import { DeferButton } from "./plan/defer-button";

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

  function onHabitResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
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

              {pendingSecondary.length > 0 && (
                <div className="border-t border-line">
                  <div className="bg-surface px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    Secundarios pendientes
                  </div>
                  <div className="flex flex-col divide-y divide-line">
                    {pendingSecondary.map((h) => (
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
                    ))}
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
