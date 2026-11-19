"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { moveBlockForDay, moveBlock } from "./actions";
import { addDaysISO } from "@/lib/date/bogota";

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 50, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// moveBlockForDay/moveBlock son Server Actions tipadas (reciben un objeto,
// no FormData — ver comentario en move-to-tomorrow-button.tsx). Estos
// adaptadores corren en el cliente, desarman el FormData que siempre manda
// SafeActionButton y llaman a la Server Action real con la forma que
// espera — así este botón también queda protegido por el mismo
// try/catch+toast que el resto del Plan, sin tocar las acciones existentes.
async function deferLater(fd: FormData) {
  return moveBlockForDay({
    date: String(fd.get("date") || ""),
    blockId: String(fd.get("blockId") || ""),
    startTime: String(fd.get("startTime") || ""),
    mode: "move",
  });
}

async function deferTomorrow(fd: FormData) {
  return moveBlock({
    date: String(fd.get("date") || ""),
    blockId: String(fd.get("blockId") || ""),
    text: String(fd.get("text") || ""),
    targetDate: String(fd.get("targetDate") || ""),
  });
}

// Botón "Aplazar" (⏭) — mini menú con "Más tarde hoy" (+30/+60/+120 min,
// mismo mecanismo que arrastrar un bloque en Agenda) y "Mañana" (igual que
// el botón homónimo del menú "⋯"). Un bloque aplazado deja de contar como
// pendiente y no rompe racha hasta su nueva hora: ambos caminos escriben
// en plan_overrides/tasks, que es justo lo que ya lee
// getPendingMinimumsForPerson/resolvePlan para decidir si algo "venció".
export function DeferButton({
  date,
  blockId,
  text,
  startTime,
  className,
}: {
  date: string;
  blockId: string;
  text: string;
  startTime: string;
  className?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  function confirmed(message: string) {
    setOpen(false);
    toast.show({ message, tone: "success" });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Aplazar"
        className={
          className ??
          "focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-ui border border-line bg-transparent text-[12px] text-ink-dim transition-colors duration-120 hover:border-line-strong hover:text-ink"
        }
      >
        {/* U+23ED + selector de variación U+FE0E: fuerza presentación de
        texto (monocromo, hereda color) en vez de la emoji a color por
        defecto de algunos sistemas — mismo tratamiento que ✓/✗, que son
        glifos de texto, no emoji. */}
        {"⏭︎"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-[210px] rounded-ui-lg border border-line bg-surface-2 p-2 shadow-lg">
            <div className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              Más tarde hoy
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[30, 60, 120].map((min) => (
                <SafeActionButton
                  key={min}
                  action={deferLater}
                  fields={{ date, blockId, startTime: addMinutes(startTime, min) }}
                  onResult={() => confirmed(`Aplazado a las ${addMinutes(startTime, min)}.`)}
                  className="flex h-9 items-center justify-center rounded-ui border border-line bg-surface text-[12px] text-ink-dim transition-colors duration-120 hover:border-line-strong hover:text-ink"
                >
                  +{min < 60 ? `${min}min` : `${min / 60}h`}
                </SafeActionButton>
              ))}
            </div>
            <div className="mt-2 px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              Mañana
            </div>
            <SafeActionButton
              action={deferTomorrow}
              fields={{ date, blockId, text, targetDate: addDaysISO(date, 1) }}
              onResult={() => confirmed("Aplazado a mañana.")}
              className="flex h-9 w-full items-center justify-center rounded-ui border border-line bg-surface text-[12px] font-medium text-ink-dim transition-colors duration-120 hover:border-line-strong hover:text-ink"
            >
              → Mañana
            </SafeActionButton>
          </div>
        </>
      )}
    </div>
  );
}
