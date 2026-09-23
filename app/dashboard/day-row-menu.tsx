"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTask, updateTaskSchedule, getTaskDetail } from "./actividades/actions";
import { archiveActivity, updateActivityTime, getActivityDetail } from "./habitos/actions";

const PRIORITY_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
const FREQ_LABEL: Record<string, string> = {
  diaria: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  unica: "Única vez",
  recurrente: "Recurrente",
};

type TaskDetail = {
  category: string | null;
  priority: string;
  dueDate: string | null;
  notes: string | null;
};
type HabitDetail = { category: string | null; frequency: string };

// Móvil · "⋯" de cada fila de tarea/hábito en "Mi día" — antes estas filas
// no tenían NINGÚN control aparte del toggle de hecho/no-hecho (el ✗ de
// "Saltado" solo existía para bloques de Plan). "Ver detalle" mandaba a
// /dashboard/actividades, una lista general que no muestra nada de ESA
// tarea puntual — pedido explícito de mostrar la info ahí mismo: al abrir
// el panel se pide el detalle real (getTaskDetail/getActivityDetail) y se
// pinta adentro, sin navegar a ningún lado. Mismo patrón visual que
// <PlanBlockMenu>.
export function TaskHabitMenu({
  kind,
  id,
  date,
  startTime,
  title,
}: {
  kind: "task" | "habit";
  id: string;
  date: string;
  startTime: string; // "HH:MM" actual, o "" si no tiene hora fija
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(startTime);
  const [detail, setDetail] = useState<TaskDetail | HabitDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || detail) return;
    setLoadingDetail(true);
    (kind === "task" ? getTaskDetail(id) : getActivityDetail(id))
      .then((row) => setDetail(row as TaskDetail | HabitDetail | null))
      .finally(() => setLoadingDetail(false));
  }, [open, detail, kind, id]);

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
              <span className="w-[62px]" />
            </div>
            <div className="px-[18px] pt-2">
              <div className="font-display text-[17px] font-bold leading-snug text-ink">{title}</div>
            </div>

            <div className="flex flex-col gap-3 px-[18px] pb-2 pt-4">
              {loadingDetail && <div className="text-[13px] text-ink-dim">Cargando…</div>}

              {detail && kind === "task" && (
                <div className="flex flex-col gap-1.5 rounded-ui border border-line bg-canvas px-3.5 py-3 text-[13px]">
                  <DetailRow label="Categoría" value={(detail as TaskDetail).category ?? "Sin categoría"} />
                  <DetailRow label="Prioridad" value={PRIORITY_LABEL[(detail as TaskDetail).priority] ?? (detail as TaskDetail).priority} />
                  <DetailRow label="Vence" value={(detail as TaskDetail).dueDate ?? "Sin fecha"} />
                  {(detail as TaskDetail).notes && <DetailRow label="Notas" value={(detail as TaskDetail).notes!} />}
                </div>
              )}
              {detail && kind === "habit" && (
                <div className="flex flex-col gap-1.5 rounded-ui border border-line bg-canvas px-3.5 py-3 text-[13px]">
                  <DetailRow label="Categoría" value={(detail as HabitDetail).category ?? "Sin categoría"} />
                  <DetailRow label="Frecuencia" value={FREQ_LABEL[(detail as HabitDetail).frequency] ?? (detail as HabitDetail).frequency} />
                </div>
              )}

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-20 shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-ink">{value}</span>
    </div>
  );
}
