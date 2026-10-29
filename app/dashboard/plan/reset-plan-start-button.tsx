"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { resetPlanStartDate } from "./actions";

// "Reiniciar desde hoy" — pone plans.start_date en hoy (America/Bogota).
// No toca el cursor de las colas (eso vive aparte en plan_queue_cursors)
// ni el historial ya guardado en plan_checks: solo corre la fecha desde
// la que el dashboard busca "sin marcar de ayer" y desde la que arrancan
// /plan/historial y /plan/fases. Irreversible desde la UI (no hay
// "volver a la fecha vieja" guardado en ningún lado) — de ahí la
// confirmación.
export function ResetPlanStartButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "¿Reiniciar el plan desde hoy? La fecha de inicio pasa a ser hoy — el historial ya guardado no se borra, pero /plan/historial, /plan/fases y el \"sin marcar de ayer\" del dashboard van a partir de hoy en adelante. No se puede deshacer desde aquí.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          const fd = new FormData();
          fd.set("planId", planId);
          await resetPlanStartDate(fd);
          router.refresh();
        });
      }}
    >
      Reiniciar desde hoy
    </Button>
  );
}
