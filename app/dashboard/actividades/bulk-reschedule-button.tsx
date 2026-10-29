"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { rescheduleOverdueTasks } from "./actions";

// "Mover todas las vencidas a…" — arriba de la lista en
// /dashboard/actividades?tiempo=vencidas. Con confirmación porque mueve
// TODAS las tareas vencidas del usuario de una sola vez (reversible solo
// a mano, tarea por tarea — por eso la confirmación nombra la cantidad).
export function BulkRescheduleOverdueButton({
  count,
  today,
  tomorrow,
}: {
  count: number;
  today: string;
  tomorrow: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetDate, setTargetDate] = useState("");

  function run(dueDate: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("dueDate", dueDate);
      await rescheduleOverdueTasks(fd);
      router.refresh();
    });
  }

  const label = `Mover las ${count} vencida${count !== 1 ? "s" : ""} a…`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-meta text-ink-dim">{label}</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(today, `¿Mover las ${count} tareas vencidas a hoy?`)}
      >
        Hoy
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(tomorrow, `¿Mover las ${count} tareas vencidas a mañana?`)}
      >
        Mañana
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => setShowDatePicker((v) => !v)}>
        📅 Elegir fecha
      </Button>
      {showDatePicker && (
        <>
          <input
            type="date"
            value={targetDate}
            min={today}
            onChange={(e) => setTargetDate(e.target.value)}
            className="focus-ring h-9 rounded-ui border border-line bg-canvas px-2 text-[13px] text-ink"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || !targetDate}
            onClick={() => run(targetDate, `¿Mover las ${count} tareas vencidas al ${targetDate}?`)}
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
        onClick={() => run("", `¿Quitarle la fecha a las ${count} tareas vencidas (backlog)?`)}
      >
        Sin fecha
      </Button>
    </div>
  );
}
