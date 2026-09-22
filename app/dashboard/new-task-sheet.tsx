"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { CATS } from "@/lib/constants/cats";

const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

// Móvil · "Nueva tarea" (pantalla 02 "Agregar" del diseño). Mismos campos y
// el mismo Server Action que <QuickAddPanel> en escritorio (title, priority,
// category, timeDue, dueDate oculto = el día que se está viendo) — categoría
// y prioridad pasan de <Select> a chips de radio nativos (sin JS propio:
// selección por :checked + `peer`), timeDue queda como input nativo. Ningún
// campo ni Server Action nuevo.
export function NewTaskSheet({
  action,
  date,
  openSignal,
  trigger,
}: {
  action: (formData: FormData) => void | Promise<void>;
  date: string;
  openSignal: boolean;
  trigger?: ReactNode;
}) {
  return (
    <Sheet
      trigger={trigger}
      open={openSignal}
      closeHref="/dashboard"
      title="Nueva tarea"
      action={action}
      hidden={{ dueDate: date }}
      submitLabel="Guardar"
    >
      <div className="rounded-ui border border-accent bg-canvas px-[13px] py-[14px]">
        <input
          name="title"
          required
          autoFocus
          placeholder="¿Qué hay que hacer?"
          className="w-full bg-transparent text-[16px] text-ink placeholder:text-ink-dim focus:outline-none"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Categoría
        </legend>
        <div className="flex flex-wrap gap-[7px]">
          <label className="cursor-pointer">
            <input type="radio" name="category" value="" defaultChecked className="peer sr-only" />
            <span className="inline-flex items-center gap-[7px] rounded-full border border-line bg-surface px-[13px] py-[9px] text-[13px] font-medium text-ink-muted transition-colors duration-120 peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-ink">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#3A3A42" }} />
              Sin categoría
            </span>
          </label>
          {Object.entries(CATS).map(([key, c]) => (
            <label key={key} className="cursor-pointer">
              <input type="radio" name="category" value={key} className="peer sr-only" />
              <span className="inline-flex items-center gap-[7px] rounded-full border border-line bg-surface px-[13px] py-[9px] text-[13px] font-medium text-ink-muted transition-colors duration-120 peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-ink">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.color }} />
                {c.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Prioridad
        </legend>
        <div className="grid grid-cols-3 gap-[7px]">
          {PRIORITIES.map((p) => (
            <label key={p.value} className="cursor-pointer">
              <input
                type="radio"
                name="priority"
                value={p.value}
                defaultChecked={p.value === "media"}
                className="peer sr-only"
              />
              <span className="flex min-h-11 items-center justify-center rounded-ui border border-line bg-surface text-[13px] font-medium text-ink-muted transition-colors duration-120 peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-ink">
                {p.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Hora (opcional)
        </span>
        <input
          type="time"
          name="timeDue"
          className="focus-ring min-h-11 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
        />
      </label>
    </Sheet>
  );
}
