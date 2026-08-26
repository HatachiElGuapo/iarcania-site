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
  initialDone,
  action,
  fieldsOn,
  fieldsOff,
  meta,
  borderColor,
}: {
  label: string;
  initialDone: boolean;
  action: (formData: FormData) => Promise<void>;
  fieldsOn: Record<string, string>;
  fieldsOff: Record<string, string>;
  meta?: React.ReactNode;
  borderColor?: string;
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
      style={borderColor ? { borderLeftColor: done ? "#1e1e1e" : borderColor } : undefined}
      className={`-mx-1 flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-white/[0.03] ${
        borderColor ? "border-l-[3px]" : ""
      } ${isPending ? "opacity-60" : ""}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${
          done ? "border-purple-mid bg-purple-mid text-white" : "border-border"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={`flex-1 truncate text-sm ${done ? "text-text-dim line-through" : "text-text-primary"}`}>
        {label}
      </span>
      {meta}
    </div>
  );
}
