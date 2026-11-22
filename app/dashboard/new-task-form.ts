"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { createTask } from "./actividades/actions";
import { getFocusAvailability, linkTaskToFocusSlot } from "./acciones/actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";

export type DateMode = "hoy" | "manana" | "elegir";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Propuesta de fin cuando solo se puso inicio: +1h, recortada a 23:59
// (editable antes de guardar) — mismo criterio que actions-card.tsx.
export function plusOneHour(hhmm: string): string {
  const total = Math.min(23 * 60 + 59, toMinutes(hhmm) + 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Modo de fecha por defecto para una `anchorDate` dada (el día que se
// estaba viendo cuando se abrió el panel) — Hoy/Mañana si coincide, si no
// "elegir" con esa fecha precargada, para no perder la capacidad de
// agregar una tarea al día que se está mirando.
export function resolveDateMode(anchorDate: string): DateMode {
  const today = todayISO();
  if (anchorDate === today) return "hoy";
  if (anchorDate === addDaysISO(today, 1)) return "manana";
  return "elegir";
}

// Lógica compartida de "Nueva tarea" (desktop: new-task-panel.tsx, móvil:
// new-task-sheet.tsx) — un solo lugar para el estado, el fetch de
// disponibilidad de "Acción 1/2/3" del día elegido (getFocusAvailability)
// y el guardado en dos pasos: createTask (ya valida fin > inicio y guarda
// time_due/time_end) y, si se marcó "Es una de mis 3 acciones",
// linkTaskToFocusSlot sobre la task recién creada.
export function useNewTaskForm(anchorDate: string, onDone: () => void) {
  const toast = useToast();
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const initialMode = resolveDateMode(anchorDate);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("media");
  const [dateMode, setDateMode] = useState<DateMode>(initialMode);
  const [customDate, setCustomDate] = useState(initialMode === "elegir" ? anchorDate : "");
  const [timeDue, setTimeDue] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // El panel sigue montado (y su estado con él) aunque se cierre entre
  // usos — si se navegó a otro día mientras tanto, la próxima apertura
  // tiene que partir de ESE día, no del que tenía la primera vez.
  useEffect(() => {
    const mode = resolveDateMode(anchorDate);
    setDateMode(mode);
    setCustomDate(mode === "elegir" ? anchorDate : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate]);
  const [wantsFocus, setWantsFocus] = useState(false);
  const [focusRank, setFocusRank] = useState<number | null>(null);
  const [occupied, setOccupied] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();

  const resolvedDate = dateMode === "hoy" ? today : dateMode === "manana" ? tomorrow : customDate;

  useEffect(() => {
    if (!resolvedDate) {
      setOccupied({});
      return;
    }
    let cancelled = false;
    getFocusAvailability(resolvedDate)
      .then((rows) => {
        if (!cancelled) setOccupied(Object.fromEntries(rows.map((r) => [r.rank, r.title])));
      })
      .catch(() => {
        if (!cancelled) setOccupied({});
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedDate]);

  // Si el rango elegido queda ocupado (otra pestaña lo llenó mientras
  // tanto) o si se destapan las 3, no deja una selección inválida/colgada.
  useEffect(() => {
    if (focusRank != null && occupied[focusRank] != null) setFocusRank(null);
  }, [occupied, focusRank]);

  function onStartChange(value: string) {
    setTimeDue(value);
    if (value && !timeEnd) setTimeEnd(plusOneHour(value));
  }

  function reset() {
    setTitle("");
    setCategory("");
    setPriority("media");
    setTimeDue("");
    setTimeEnd("");
    setWantsFocus(false);
    setFocusRank(null);
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (!resolvedDate) {
      toast.show({ message: "Elegí una fecha.", tone: "error" });
      return;
    }
    if (timeDue && timeEnd && toMinutes(timeEnd) <= toMinutes(timeDue)) {
      toast.show({ message: "La hora de fin debe ser mayor que la de inicio.", tone: "error" });
      return;
    }
    if (wantsFocus && focusRank == null) {
      toast.show({ message: "Elegí en qué posición (Acción 1, 2 o 3).", tone: "error" });
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("title", trimmed);
        fd.set("dueDate", resolvedDate);
        fd.set("priority", priority);
        if (category) fd.set("category", category);
        if (timeDue) fd.set("timeDue", timeDue);
        if (timeEnd) fd.set("timeEnd", timeEnd);
        const created = await createTask(fd);
        if (wantsFocus && focusRank != null && created?.id) {
          await linkTaskToFocusSlot({ date: resolvedDate, rank: focusRank, taskId: created.id });
        }
        reset();
        onDone();
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo agregar.", tone: "error" });
      }
    });
  }

  const freeRanks = [0, 1, 2].filter((r) => occupied[r] == null);

  return {
    title,
    setTitle,
    category,
    setCategory,
    priority,
    setPriority,
    dateMode,
    setDateMode,
    customDate,
    setCustomDate,
    timeDue,
    setTimeDue,
    timeEnd,
    setTimeEnd,
    onStartChange,
    wantsFocus,
    setWantsFocus,
    focusRank,
    setFocusRank,
    occupied,
    freeRanks,
    allFocusSlotsOccupied: freeRanks.length === 0,
    resolvedDate,
    pending,
    submit,
  };
}
