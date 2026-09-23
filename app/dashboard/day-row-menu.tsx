"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTask, updateTaskSchedule } from "./actividades/actions";
import { archiveActivity, updateActivityTime } from "./habitos/actions";

// Móvil · "⋯" de cada fila de tarea/hábito en "Mi día" — antes estas filas
// no tenían NINGÚN control aparte del toggle de hecho/no-hecho (el ✗ de
// "Saltado" solo existía para bloques de Plan, no para tareas ni hábitos —
// inconsistente y, para lo que hacía falta, no servía: no dejaba cambiar
// la hora, eliminar ni dejar un hábito inactivo). Mismo patrón visual que
// <PlanBlockMenu>.
export function TaskHabitMenu({
  kind,
  id,
  date,
  startTime,
  title,
  detailHref,
}: {
  kind: "task" | "habit";
  id: string;
  date: string;
  startTime: string; // "HH:MM" actual, o "" si no tiene hora fija
  title: string;
  detailHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(startTime);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      setOpen(false);
      router.refresh();
    });
  }

  const saveTime = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", id);
      if (kind === "task") {
        fd.set("dueDate", date);
        fd.set("timeDue", time);
        return updateTaskSchedule(fd);
      }
      fd.set("horaSugerida", time);
      return updateActivityTime(fd);
    });

  const remove = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", id);
      return deleteTask(fd);
    });

  const deactivate = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", id);
      return archiveActivity(fd);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Más acciones"
        className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-ui border border-line text-[15px] text-ink-dim"
      >
        ⋯
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-[14px] border-t border-line-strong bg-surface-2 pb-[max(18px,env(safe-area-inset-bottom))]"
          >
            <div className="flex justify-center pt-[11px]">
              <span className="h-1 w-[38px] rounded-full bg-line-strong" />
            </div>
            <div className="flex items-center justify-between px-[18px] pt-4">
              <button type="button" onClick={() => setOpen(false)} className="focus-ring text-[14px] text-ink-muted">
                Cancelar
              </button>
              <span className="min-w-0 truncate px-2 text-[13px] text-ink-dim">{title}</span>
              <span className="w-[62px]" />
            </div>
            <div className="flex flex-col gap-3 px-[18px] pb-2 pt-4">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                />
                <button
                  type="button"
                  disabled={pending || !time}
                  onClick={saveTime}
                  className="flex min-h-11 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft px-4 text-[13px] font-medium text-ink disabled:opacity-50"
                >
                  Guardar hora
                </button>
              </div>

              <a
                href={detailHref}
                className="flex min-h-11 items-center justify-center rounded-ui border border-line text-[13px] font-medium text-ink-muted"
              >
                Ver detalle →
              </a>

              {kind === "task" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={remove}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-ui border border-danger/40 bg-danger/12 text-[13px] font-medium text-danger disabled:opacity-50"
                >
                  Eliminar tarea
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={deactivate}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-ui border border-line text-[13px] font-medium text-ink-dim disabled:opacity-50"
                >
                  Dejar hábito inactivo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
