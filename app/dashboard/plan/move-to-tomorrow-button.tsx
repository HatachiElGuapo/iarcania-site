"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { moveBlock, moveBlockToEndOfQueue } from "./actions";
import { addDaysISO } from "@/lib/date/bogota";

// Escritorio · botones sueltos para el panel "Cambiar solo hoy" de Rutinas
// — moveBlock/moveBlockToEndOfQueue son Server Actions tipadas (reciben un
// objeto, no FormData), así que necesitan un componente cliente para
// llamarlas directo en vez de un <form action> plano como el resto del
// panel.
export function MoveBlockButtons({ date, blockId, text }: { date: string; blockId: string; text: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetDate, setTargetDate] = useState("");

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(() => moveBlock({ date, blockId, text, targetDate: addDaysISO(date, 1) }))}
      >
        → Mañana
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => setShowDatePicker((v) => !v)}>
        📅 Elegir fecha
      </Button>
      {showDatePicker && (
        <>
          <input
            type="date"
            value={targetDate}
            min={date}
            onChange={(e) => setTargetDate(e.target.value)}
            className="focus-ring h-9 rounded-ui border border-line bg-canvas px-2 text-[13px] text-ink"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || !targetDate}
            onClick={() => run(() => moveBlock({ date, blockId, text, targetDate }))}
          >
            Mover
          </Button>
        </>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() =>
            moveBlockToEndOfQueue({ date, blockId }).catch((err) => {
              alert(err instanceof Error ? err.message : "No se pudo mover");
            }),
          )
        }
      >
        ⇥ Al final de la cola
      </Button>
    </div>
  );
}
