"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast, type ToastInput } from "@/components/ui/toast";
import {
  pickBlockPraise,
  streakMilestoneCrossed,
  pickStreakMilestoneMessage,
  pickProtectorGainedMessage,
} from "@/lib/plan/praise";

// Si quien llama no pasa `onResult`, el resultado se interpreta solo por su
// forma — así un uso genérico desde un Server Component (sin closures, que
// no pueden cruzar a un Client Component) también obtiene su toast de
// felicitación/racha, igual que los wrappers dedicados (PlanCheckButton,
// etc.) que sí lo calculan explícito.
// Tras un deploy, el bundle viejo en el navegador referencia Server
// Actions que el server nuevo ya no conoce — Next.js lo reporta como este
// mensaje. No es un error de negocio: recargar trae el bundle nuevo.
function isStaleServerActionError(err: unknown): boolean {
  return err instanceof Error && /Failed to find Server Action/i.test(err.message);
}

function defaultOnResult(result: unknown, toast: { show: (t: ToastInput) => void }) {
  if (!result || typeof result !== "object") return;
  if ("toastMessage" in result) {
    const r = result as { done: boolean; toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
    return;
  }
  if ("isMinimum" in result) {
    const r = result as {
      done: boolean;
      isMinimum: boolean;
      allMinimumsDone: boolean;
      streakBefore: number;
      streakAfter: number;
      protectorsBefore: number;
      protectorsAfter: number;
    };
    if (!r.done) return;
    const milestone = streakMilestoneCrossed(r.streakBefore, r.streakAfter);
    if (milestone) {
      toast.show({ message: pickStreakMilestoneMessage(milestone), tone: "success" });
    } else if (r.protectorsAfter > r.protectorsBefore) {
      toast.show({ message: pickProtectorGainedMessage(), tone: "success" });
    } else {
      toast.show({ message: pickBlockPraise(r), tone: "success" });
    }
  }
}

// Reemplaza un <form action={serverAction}> plano cuando esa Server Action
// puede lanzar en casos que no son "bug" (ej. un dato desalineado, un
// bloque que ya no aplica) — sin esto, un throw sin atrapar tumba todo el
// árbol de la ruta (pantalla de error) en vez de avisar y seguir. Éxito:
// refresca la página y, si se pasó `onResult`, entrega lo que devolvió la
// action (ej. para decidir un toast de felicitación); si no, usa
// `defaultOnResult`. Error: toast rojo con el mensaje, sin romper nada más.
export function SafeActionButton({
  action,
  fields,
  className,
  disabled,
  onResult,
  children,
}: {
  action: (formData: FormData) => Promise<unknown> | void;
  fields: Record<string, string>;
  className?: string;
  disabled?: boolean;
  onResult?: (result: unknown) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        const result = await action(fd);
        if (onResult) onResult(result);
        else defaultOnResult(result, toast);
        router.refresh();
      } catch (err) {
        if (isStaleServerActionError(err)) {
          toast.show({ message: "Hay una versión nueva, recargando…", tone: "error" });
          window.location.reload();
          return;
        }
        toast.show({ message: err instanceof Error ? err.message : "Algo salió mal.", tone: "error" });
      }
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={disabled || pending} className={className}>
      {children}
    </button>
  );
}
