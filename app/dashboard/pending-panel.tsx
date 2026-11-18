"use client";

import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/ui";
import type { PendingMinimumBlock } from "@/lib/plan/pending";

// Panel de "Pendientes" — solo bloques is_minimum de Plan cuya hora de
// vencimiento ya pasó y todavía no se marcaron (ver lib/plan/pending.ts).
// Mismo patrón de overlay que <QuickAddPanel>.
export function PendingPanel({
  trigger,
  pendingMinimums,
}: {
  trigger: ReactNode;
  pendingMinimums: PendingMinimumBlock[];
}) {
  const [open, setOpen] = useState(false);
  const pending = pendingMinimums;

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
            <div className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto">
              {pending.length === 0 ? (
                <EmptyState icon="🎉">No hay mínimos vencidos sin marcar.</EmptyState>
              ) : (
                pending.map((p) => (
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
          </div>
        </div>
      )}
    </>
  );
}
