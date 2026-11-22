"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATS } from "@/lib/constants/cats";
import { useNewTaskForm } from "./new-task-form";

const DATE_MODE_LABEL: Record<"hoy" | "manana" | "elegir", string> = { hoy: "Hoy", manana: "Mañana", elegir: "Elegir" };

// "+ Nueva tarea" (encabezado) / "+ Tarea" (Tu día), escritorio — mismo
// popover de siempre (QuickAddPanel), pero con su propia lógica (ver
// new-task-form.ts) en vez de un <form action={createTask}> plano: hora
// de inicio/fin, fecha Hoy/Mañana/elegir y el selector "Es una de mis 3
// acciones" necesitan estado propio y un guardado en dos pasos
// (createTask + linkTaskToFocusSlot), no solo mandar un FormData.
export function NewTaskPanel({ trigger, date }: { trigger: ReactNode; date: string }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useNewTaskForm(date, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
            className="mt-[8vh] w-full max-w-sm overflow-hidden rounded-ui-lg border border-line-strong bg-surface-2"
          >
            <div className="flex items-center border-b border-line bg-surface px-3.5 py-3">
              <span className="text-[13px] font-medium text-ink">Nueva tarea</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="focus-ring ml-auto rounded-ui px-1 text-[13px] text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[75vh] flex-col gap-2.5 overflow-y-auto p-3.5">
              <input
                ref={inputRef}
                value={form.title}
                onChange={(e) => form.setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") form.submit();
                }}
                placeholder="Nueva tarea para hoy…"
                disabled={form.pending}
                className="focus-ring rounded-ui border border-line bg-canvas px-3 py-2 text-body text-ink placeholder:text-ink-dim"
              />

              <div className="flex gap-2">
                <select
                  value={form.priority}
                  onChange={(e) => form.setPriority(e.target.value)}
                  disabled={form.pending}
                  className="focus-ring flex-1 rounded-ui border border-line bg-canvas px-2 py-1.5 text-[13px] text-ink"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
                <select
                  value={form.category}
                  onChange={(e) => form.setCategory(e.target.value)}
                  disabled={form.pending}
                  className="focus-ring flex-1 rounded-ui border border-line bg-canvas px-2 py-1.5 text-[13px] text-ink"
                >
                  <option value="">Sin categoría</option>
                  {Object.entries(CATS).map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  {(["hoy", "manana", "elegir"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => form.setDateMode(m)}
                      disabled={form.pending}
                      className={`flex-1 rounded-ui border px-2 py-1.5 text-[12px] font-medium ${
                        form.dateMode === m ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-dim"
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
                    className="focus-ring rounded-ui border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink"
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                <span>de</span>
                <input
                  type="time"
                  value={form.timeDue}
                  onChange={(e) => form.onStartChange(e.target.value)}
                  disabled={form.pending}
                  className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
                />
                <span>a</span>
                <input
                  type="time"
                  value={form.timeEnd}
                  onChange={(e) => form.setTimeEnd(e.target.value)}
                  disabled={form.pending}
                  className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
                />
              </div>

              <label className="flex items-center gap-2 text-[12px] text-ink-dim">
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
                  <p className="text-[11px] text-danger">Las 3 acciones de ese día ya están ocupadas.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((r) => {
                      const occupiedTitle = form.occupied[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={form.pending || occupiedTitle != null}
                          title={occupiedTitle ?? undefined}
                          onClick={() => form.setFocusRank(r)}
                          className={`rounded-ui border px-2 py-1.5 text-[11px] font-medium ${
                            form.focusRank === r
                              ? "border-accent bg-accent-soft text-ink"
                              : occupiedTitle != null
                                ? "border-line text-ink-dim/40"
                                : "border-line text-ink-dim"
                          }`}
                        >
                          Acción {r + 1}
                        </button>
                      );
                    })}
                  </div>
                ))}

              <button
                type="button"
                onClick={form.submit}
                disabled={form.pending || !form.title.trim()}
                className="focus-ring self-start rounded-ui bg-accent px-3.5 py-2 text-body font-medium text-white transition-colors duration-120 hover:bg-accent/90 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
