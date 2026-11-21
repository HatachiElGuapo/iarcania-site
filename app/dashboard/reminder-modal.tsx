"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { BottomSheetModal } from "./compact-modal-card";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import { subscribeReminder, type ReminderPayload } from "./reminder-bus";

// Montado una vez en el layout del dashboard — escucha el bus de
// recordatorios (ver reminder-bus.ts) y se abre con el texto configurado
// en activities.reminder_text apenas CUALQUIER toggle de hábito (árbol,
// tarjetas, móvil) dispara uno. "Ya lo hice" reusa toggleLogToday tal cual
// sobre el hábito destino (reminder_activity_id) — solo se llega acá
// cuando ese destino no está done todavía, así que togglearlo siempre lo
// completa, nunca lo desmarca. Usa la misma pila de modales que el resto
// (BottomSheetModal), así que si ya hay otro modal abierto este se apila
// encima sin pisarlo.
export function ReminderModal() {
  const [payload, setPayload] = useState<ReminderPayload | null>(null);
  const toast = useToast();

  useEffect(() => subscribeReminder(setPayload), []);

  function close() {
    setPayload(null);
  }

  function onDoneResult(result: unknown) {
    close();
    if (!result || typeof result !== "object") return;
    const r = result as { toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

  return (
    <BottomSheetModal
      open={!!payload}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Recordatorio"
      widthClassName="md:max-w-sm"
    >
      {payload && (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-center text-[17px] text-ink">{payload.text}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="focus-ring flex min-h-11 flex-1 items-center justify-center rounded-ui border border-line text-[14px] text-ink-dim"
            >
              Después
            </button>
            <SafeActionButton
              action={toggleLogToday}
              fields={{ activityId: payload.targetActivityId, date: payload.date }}
              onResult={onDoneResult}
              className="flex min-h-11 flex-1 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft text-[14px] font-medium text-ink"
            >
              Ya lo hice
            </SafeActionButton>
          </div>
        </div>
      )}
    </BottomSheetModal>
  );
}
