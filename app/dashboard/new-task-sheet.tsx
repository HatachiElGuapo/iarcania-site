"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CATS } from "@/lib/constants/cats";
import { useNewTaskForm } from "./new-task-form";

const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];
const DATE_MODE_LABEL: Record<"hoy" | "manana" | "elegir", string> = { hoy: "Hoy", manana: "Mañana", elegir: "Elegir" };

// Móvil · "Nueva tarea" (pantalla 02 "Agregar" del diseño). Misma lógica
// que <NewTaskPanel> de escritorio (ver new-task-form.ts) — hora de
// inicio/fin, fecha Hoy/Mañana/elegir y "Es una de mis 3 acciones" — con
// el chrome de bottom sheet propio (agarradera, Cancelar/Guardar arriba),
// hecho a mano en vez de reusar <Sheet> con su `<form action>` plano: el
// guardado en dos pasos (createTask + linkTaskToFocusSlot) y los campos
// no-nativos (fecha elegida, posición) necesitan su propio botón
// "Guardar", no un submit nativo.
export function NewTaskSheet({
  date,
  openSignal,
  trigger,
}: {
  date: string;
  openSignal: boolean;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!openSignal);
  const [visible, setVisible] = useState(false);

  function close() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
    router.replace("/dashboard");
  }

  const form = useNewTaskForm(date, close);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {trigger && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger}
        </span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`w-full max-w-md rounded-t-[14px] border-t border-line-strong bg-surface-2 pb-[max(18px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
              visible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex justify-center pt-[11px]">
              <span className="h-1 w-[38px] rounded-full bg-line-strong" />
            </div>
            <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto px-[18px] pt-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={close} className="focus-ring text-[14px] text-ink-muted">
                  Cancelar
                </button>
                <span className="font-display text-[17px] font-bold text-ink">Nueva tarea</span>
                <button
                  type="button"
                  onClick={form.submit}
                  disabled={form.pending || !form.title.trim()}
                  className="focus-ring text-[14px] font-semibold text-accent disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>

              <div className="rounded-ui border border-accent bg-canvas px-[13px] py-[14px]">
                <input
                  ref={titleRef}
                  value={form.title}
                  onChange={(e) => form.setTitle(e.target.value)}
                  placeholder="¿Qué hay que hacer?"
                  disabled={form.pending}
                  className="w-full bg-transparent text-[16px] text-ink placeholder:text-ink-dim focus:outline-none"
                />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Categoría
                </legend>
                <div className="flex flex-wrap gap-[7px]">
                  <button
                    type="button"
                    onClick={() => form.setCategory("")}
                    disabled={form.pending}
                    className={`inline-flex items-center gap-[7px] rounded-full border px-[13px] py-[9px] text-[13px] font-medium transition-colors duration-120 ${
                      form.category === "" ? "border-accent/50 bg-accent-soft text-ink" : "border-line bg-surface text-ink-muted"
                    }`}
                  >
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#3A3A42" }} />
                    Sin categoría
                  </button>
                  {Object.entries(CATS).map(([key, c]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => form.setCategory(key)}
                      disabled={form.pending}
                      className={`inline-flex items-center gap-[7px] rounded-full border px-[13px] py-[9px] text-[13px] font-medium transition-colors duration-120 ${
                        form.category === key ? "border-accent/50 bg-accent-soft text-ink" : "border-line bg-surface text-ink-muted"
                      }`}
                    >
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Prioridad
                </legend>
                <div className="grid grid-cols-3 gap-[7px]">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => form.setPriority(p.value)}
                      disabled={form.pending}
                      className={`flex min-h-11 items-center justify-center rounded-ui border text-[13px] font-medium transition-colors duration-120 ${
                        form.priority === p.value ? "border-accent/50 bg-accent-soft text-ink" : "border-line bg-surface text-ink-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Día</legend>
                <div className="grid grid-cols-3 gap-[7px]">
                  {(["hoy", "manana", "elegir"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => form.setDateMode(m)}
                      disabled={form.pending}
                      className={`flex min-h-11 items-center justify-center rounded-ui border text-[13px] font-medium transition-colors duration-120 ${
                        form.dateMode === m ? "border-accent/50 bg-accent-soft text-ink" : "border-line bg-surface text-ink-muted"
                      }`}
                    >
                      {DATE_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
                {form.dateMode === "elegir" && (
                  <input
                    type="date"
                    value={form.customDate}
                    onChange={(e) => form.setCustomDate(e.target.value)}
                    disabled={form.pending}
                    className="focus-ring min-h-11 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                  />
                )}
              </fieldset>

              <label className="flex flex-col gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  De — a (opcional)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={form.timeDue}
                    onChange={(e) => form.onStartChange(e.target.value)}
                    disabled={form.pending}
                    className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                  />
                  <span className="text-ink-dim">a</span>
                  <input
                    type="time"
                    value={form.timeEnd}
                    onChange={(e) => form.setTimeEnd(e.target.value)}
                    disabled={form.pending}
                    className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                  />
                </div>
              </label>

              <fieldset className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] text-ink-dim">
                  <input
                    type="checkbox"
                    checked={form.wantsFocus}
                    disabled={form.pending || form.allFocusSlotsOccupied}
                    onChange={(e) => {
                      form.setWantsFocus(e.target.checked);
                      if (!e.target.checked) form.setFocusRank(null);
                    }}
                  />
                  Es una de mis 3 acciones
                </label>
                {form.wantsFocus &&
                  (form.allFocusSlotsOccupied ? (
                    <p className="text-[12px] text-danger">Las 3 acciones de ese día ya están ocupadas.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-[7px]">
                      {[0, 1, 2].map((r) => {
                        const occupiedTitle = form.occupied[r];
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={form.pending || occupiedTitle != null}
                            onClick={() => form.setFocusRank(r)}
                            className={`flex min-h-11 items-center justify-center rounded-ui border text-[13px] font-medium transition-colors duration-120 ${
                              form.focusRank === r
                                ? "border-accent/50 bg-accent-soft text-ink"
                                : occupiedTitle != null
                                  ? "border-line bg-surface text-ink-dim/40"
                                  : "border-line bg-surface text-ink-muted"
                            }`}
                          >
                            Acción {r + 1}
                          </button>
                        );
                      })}
                    </div>
                  ))}
              </fieldset>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
