"use client";

import { useState, useTransition } from "react";

// Fila de tarea/hábito con feedback instantáneo — sin useOptimistic (requiere
// React 19, este proyecto está en 18.3) pero con el mismo efecto: estado
// local que cambia al toque, la Server Action corre en segundo plano vía
// startTransition, y si falla se revierte. revalidatePath en la acción
// termina de sincronizar con el estado real sin parpadeo (cuando la acción
// tiene éxito el valor optimista y el real ya coinciden).
//
// RSC no permite pasar funciones de un Server Component a un Client
// Component como props salvo Server Actions ("Functions cannot be passed
// directly to Client Components") — ni como children, ni como cualquier
// otra prop. Por eso `fieldsOn`/`fieldsOff` son objetos planos ya resueltos
// en el servidor, no callbacks: para hábitos (donde el toggle no depende de
// dirección) son el mismo objeto; para tareas difieren solo en `nextStatus`.
export function ToggleRow({
  label,
  sublabel,
  prefix,
  initialDone,
  action,
  fieldsOn,
  fieldsOff,
  meta,
  borderColor,
  boxed = false,
  circle = false,
}: {
  label: string;
  /** Segunda línea bajo el label (ej. hora sugerida de un hábito). */
  sublabel?: React.ReactNode;
  /** Contenido entre la casilla y el label (ej. columna de hora de una tarea). */
  prefix?: React.ReactNode;
  initialDone: boolean;
  action: (formData: FormData) => Promise<void>;
  fieldsOn: Record<string, string>;
  fieldsOff: Record<string, string>;
  meta?: React.ReactNode;
  borderColor?: string;
  /** Fila como tarjeta propia (fondo + borde), en vez de solo un hover sutil. */
  boxed?: boolean;
  /** Casilla circular (hábitos) en vez de cuadrada (tareas). */
  circle?: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(next ? fieldsOn : fieldsOff).forEach(([k, v]) => fd.set(k, v));
      try {
        await action(fd);
      } catch {
        setDone(!next);
      }
    });
  }

  return (
    <div
      onClick={toggle}
      style={borderColor ? { borderLeftColor: done ? "#262629" : borderColor } : undefined}
      className={`flex cursor-pointer items-center gap-2.5 transition-colors duration-120 ${
        boxed
          ? `rounded-ui-lg border border-line bg-surface px-3.5 py-2.5 hover:border-line-strong ${borderColor ? "border-l-[3px]" : ""}`
          : `-mx-1 rounded-ui px-2 py-1.5 hover:bg-surface-2 ${borderColor ? "border-l-[3px]" : ""}`
      } ${isPending ? "opacity-60" : ""}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center border text-[10px] ${
          circle ? "h-5 w-5 rounded-full" : "h-[18px] w-[18px] rounded"
        } ${done ? "border-accent bg-accent text-white" : "border-line-strong"}`}
      >
        {done ? "✓" : ""}
      </span>
      {prefix}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${done ? "text-ink-dim line-through" : "text-ink"}`}>
          {label}
        </span>
        {sublabel && <span className="mt-0.5 block truncate text-[10px] text-ink-dim">{sublabel}</span>}
      </span>
      {meta}
    </div>
  );
}
