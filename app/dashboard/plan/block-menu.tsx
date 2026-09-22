"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveBlockForDay, moveBlockToTomorrow, setCheck } from "./actions";

// Móvil · "⋯" de cada bloque de Rutinas — atrasar dentro del mismo día o
// mandarlo a mañana sin que se pierda, con un toque (pedido explícito: "a
// veces me puedo atrasar 2 horas y no por eso esa actividad debe
// desaparecer"). Reusa moveBlockForDay tal cual (el mismo que usa arrastrar
// en Agenda) — acá solo calculamos el nuevo horario a partir del actual en
// vez de leerlo de un drag.
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 50, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PlanBlockMenu({
  date,
  blockId,
  startTime,
  text,
  isSkipped,
}: {
  date: string;
  blockId: string;
  startTime: string;
  text: string;
  isSkipped: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      setOpen(false);
      router.refresh();
    });
  }

  const postpone = (minutes: number) =>
    run(() => moveBlockForDay({ date, blockId, startTime: addMinutes(startTime, minutes), mode: "move" }));

  const toTomorrow = () => run(() => moveBlockToTomorrow({ date, blockId, text }));

  const toggleSkip = () =>
    run(() => {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("blockId", blockId);
      fd.set("status", isSkipped ? "" : "skipped");
      return setCheck(fd);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Más acciones"
        className={`focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-ui border text-[15px] ${
          isSkipped ? "border-danger/40 bg-danger/12 text-danger" : "border-line text-ink-dim"
        }`}
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
              <span className="min-w-0 truncate px-2 text-[13px] text-ink-dim">{text}</span>
              <span className="w-[62px]" />
            </div>
            <div className="flex flex-col gap-2 px-[18px] pb-2 pt-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Atrasar hoy
              </div>
              <div className="grid grid-cols-3 gap-[7px]">
                {[30, 60, 120].map((min) => (
                  <button
                    key={min}
                    type="button"
                    disabled={pending}
                    onClick={() => postpone(min)}
                    className="flex min-h-11 items-center justify-center rounded-ui border border-line bg-surface text-[13px] font-medium text-ink-muted transition-colors duration-120 disabled:opacity-50"
                  >
                    +{min < 60 ? `${min} min` : `${min / 60}h`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={toTomorrow}
                className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-ui border border-accent/40 bg-accent-soft text-[13px] font-medium text-ink disabled:opacity-50"
              >
                → Mover a mañana
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={toggleSkip}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-ui border text-[13px] font-medium disabled:opacity-50 ${
                  isSkipped ? "border-danger/40 bg-danger/12 text-danger" : "border-line text-ink-dim"
                }`}
              >
                {isSkipped ? "Quitar salto" : "✗ Saltar este bloque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
