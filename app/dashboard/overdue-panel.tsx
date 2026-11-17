"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, catInfo } from "@/components/ui";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { toggleTaskStatus, rescheduleTask, archiveTask } from "./actividades/actions";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-danger",
  media: "text-accent-warm",
  baja: "text-ink-dim",
};

export type OverdueTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  category: string | null;
};

// Panel de "Vencidas" — todas las acciones reusan server actions ya
// existentes en actividades/actions.ts (completar, reprogramar, archivar).
export function OverduePanel({ trigger, tasks }: { trigger: ReactNode; tasks: OverdueTask[] }) {
  const [open, setOpen] = useState(false);

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
              <span className="font-display text-[15px] font-semibold text-danger">Tareas vencidas</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-ui px-2 py-1 text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto">
              {tasks.length === 0 ? (
                <EmptyState icon="✅">No tenés tareas vencidas.</EmptyState>
              ) : (
                tasks.map((t) => <OverdueRow key={t.id} task={t} />)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OverdueRow({ task }: { task: OverdueTask }) {
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [pending, startTransition] = useTransition();
  const cat = task.category ? catInfo(task.category) : null;

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const complete = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", task.id);
      fd.set("nextStatus", "completada");
      return toggleTaskStatus(fd);
    });

  const moveTo = (dueDate: string) =>
    run(() => {
      const fd = new FormData();
      fd.set("id", task.id);
      fd.set("dueDate", dueDate);
      return rescheduleTask(fd);
    });

  const archive = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", task.id);
      return archiveTask(fd);
    });

  return (
    <div className="flex flex-col gap-2 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
        {cat && (
          <span className="shrink-0 text-[10px]" style={{ color: cat.color }}>
            {cat.label}
          </span>
        )}
        <span className={`shrink-0 text-xs font-semibold ${PRIORITY_COLOR[task.priority]}`}>●</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={complete}
          className="focus-ring rounded-ui border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success disabled:opacity-50"
        >
          ✓ Completar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => moveTo(todayISO())}
          className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink disabled:opacity-50"
        >
          Hoy
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => moveTo(addDaysISO(todayISO(), 1))}
          className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink disabled:opacity-50"
        >
          Mañana
        </button>
        {showDatePicker ? (
          <span className="flex items-center gap-1">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="focus-ring rounded-ui border border-line bg-canvas px-2 py-1 text-[11px] text-ink"
            />
            <button
              type="button"
              disabled={pending || !targetDate}
              onClick={() => moveTo(targetDate)}
              className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2 py-1 text-[11px] font-medium text-ink disabled:opacity-50"
            >
              Mover
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink"
          >
            📅 Elegir fecha
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={archive}
          className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-danger disabled:opacity-50"
        >
          Archivar
        </button>
      </div>
    </div>
  );
}
