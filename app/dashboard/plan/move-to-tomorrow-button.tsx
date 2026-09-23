"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { moveBlockToTomorrow } from "./actions";

// Escritorio · botón suelto para el panel "Cambiar solo hoy" de Rutinas —
// moveBlockToTomorrow es una Server Action tipada (recibe un objeto, no
// FormData), así que necesita un componente cliente para llamarla directo
// en vez de un <form action> plano como el resto del panel.
export function MoveToTomorrowButton({ date, blockId, text }: { date: string; blockId: string; text: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await moveBlockToTomorrow({ date, blockId, text });
          router.refresh();
        })
      }
    >
      → Mover a mañana
    </Button>
  );
}
