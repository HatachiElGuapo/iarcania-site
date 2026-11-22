"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useBusyGuard } from "../busy-guard";
import { adjustCounter } from "../habitos/actions";

// Tras un deploy, el bundle viejo referencia Server Actions que el server
// nuevo ya no conoce — mismo tratamiento que en los demás componentes que
// llaman Server Actions directo (sin pasar por SafeActionButton).
function isStaleServerActionError(err: unknown): boolean {
  return err instanceof Error && /Failed to find Server Action/i.test(err.message);
}

// Botones grandes +N/−N de un hábito con meta ("1000 saltos", target_value)
// — zona táctil de 44px mínimo, mismo adjustCounter en TODOS los lugares
// donde puede aparecer un hábito contador: el árbol del Plan (habit-tree-
// dnd.tsx), la tarjeta de Hábitos (habits-card.tsx) y ahora también la
// lista de secundarios (SecondaryCard, el bloque kind='secundarios' y
// Pendientes — ver secondary-section.tsx/pending-panel.tsx). `−` siempre
// resta el primer paso configurado (mismo que el primer botón "+"), no un
// valor fijo aparte.
export function CounterControls({
  activityId,
  countSteps,
  date,
  onChanged,
}: {
  activityId: string;
  countSteps: number[] | null;
  date: string;
  onChanged: (activityId: string, value: number, done: boolean, toastMessage: string | null) => void;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  useBusyGuard(pending);
  const steps = countSteps && countSteps.length > 0 ? countSteps : [100];

  async function adjust(delta: number) {
    setPending(true);
    try {
      const result = await adjustCounter({ activityId, date, delta });
      onChanged(activityId, result.value, result.done, result.toastMessage);
    } catch (err) {
      if (isStaleServerActionError(err)) {
        toast.show({ message: "Hay una versión nueva, recargando…", tone: "error" });
        window.location.reload();
        return;
      }
      toast.show({ message: err instanceof Error ? err.message : "No se pudo actualizar.", tone: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => adjust(-steps[0])}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-ui border border-line bg-surface px-3 text-[13px] font-medium text-ink-dim disabled:opacity-50"
      >
        −{steps[0]}
      </button>
      {steps.map((step) => (
        <button
          key={step}
          type="button"
          disabled={pending}
          onClick={() => adjust(step)}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft px-3 text-[13px] font-medium text-ink disabled:opacity-50"
        >
          +{step}
        </button>
      ))}
    </div>
  );
}
