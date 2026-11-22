"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { toggleTaskStatus, rescheduleTask, deleteTask } from "../actividades/actions";
import { addPlanExtra } from "./extras-actions";
import { addDaysISO } from "@/lib/date/bogota";
import type { PlanExtra } from "@/lib/plan/extras";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function plusOneHour(hhmm: string): string {
  const total = Math.min(23 * 60 + 59, toMinutes(hhmm) + 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function fmtRange(timeDue: string | null, timeEnd: string | null): string | null {
  if (!timeDue) return null;
  return timeEnd ? `de ${timeDue} a ${timeEnd}` : timeDue;
}

function ExtraRow({
  extra,
  date,
  onToggled,
  onRemoved,
}: {
  extra: PlanExtra;
  date: string;
  onToggled: (id: string, done: boolean) => void;
  onRemoved: (id: string) => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onToggleResult() {
    onToggled(extra.id, !extra.done);
  }

  function remove() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", extra.id);
        await deleteTask(fd);
        onRemoved(extra.id);
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo borrar.", tone: "error" });
      }
    });
  }

  const range = fmtRange(extra.timeDue, extra.timeEnd);

  return (
    <div className="flex items-center gap-1.5 rounded-ui border border-line bg-surface px-2 py-1.5">
      <SafeActionButton
        action={toggleTaskStatus}
        fields={{ id: extra.id, nextStatus: extra.done ? "pendiente" : "completada" }}
        onResult={onToggleResult}
        className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-ui py-0.5 text-left"
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
            extra.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
          }`}
        >
          ✓
        </span>
        {range && <span className="shrink-0 text-[10px] tabular-nums text-ink-dim">{range}</span>}
        <span className={`min-w-0 truncate text-[12px] ${extra.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {extra.title}
        </span>
      </SafeActionButton>
      <SafeActionButton
        action={rescheduleTask}
        fields={{ id: extra.id, dueDate: addDaysISO(date, 1) }}
        onResult={() => onRemoved(extra.id)}
        className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border border-line text-[11px] text-ink-dim hover:border-line-strong hover:text-ink"
      >
        {"⏭︎"}
      </SafeActionButton>
      {confirmDelete ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="focus-ring flex h-6 items-center justify-center rounded-ui border border-line px-1.5 text-[10px] text-ink-muted"
          >
            Conservar
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Confirmar borrado"
            className="focus-ring flex h-6 items-center justify-center rounded-ui bg-danger px-1.5 text-[10px] font-medium text-white disabled:opacity-50"
          >
            Borrar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          title={`¿Borrar «${extra.title}»? No se puede deshacer.`}
          className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border border-line text-[11px] text-ink-dim hover:border-danger/40 hover:text-danger"
        >
          🗑
        </button>
      )}
    </div>
  );
}

function AddExtraForm({ date, blockId, onAdded }: { date: string; blockId: string; onAdded: (extra: PlanExtra) => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function onStartChange(value: string) {
    setStart(value);
    if (value && !end) setEnd(plusOneHour(value));
  }

  function submit() {
    if (!title.trim()) return;
    if (start && end && toMinutes(end) <= toMinutes(start)) {
      toast.show({ message: "La hora de fin debe ser mayor que la de inicio.", tone: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("date", date);
    fd.set("blockId", blockId);
    fd.set("title", title.trim());
    if (start) fd.set("timeDue", start);
    if (end) fd.set("timeEnd", end);
    startTransition(async () => {
      try {
        await addPlanExtra(fd);
        onAdded({ id: crypto.randomUUID(), title: title.trim(), timeDue: start || null, timeEnd: end || null, done: false });
        setTitle("");
        setStart("");
        setEnd("");
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo agregar.", tone: "error" });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="+ extra solo de hoy…"
        disabled={pending}
        className="focus-ring min-w-[110px] flex-1 rounded-ui border border-line bg-canvas px-2 py-1 text-[12px] text-ink placeholder:text-ink-dim"
      />
      <input
        type="time"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        disabled={pending}
        className="focus-ring w-[82px] shrink-0 rounded-ui border border-line bg-canvas px-1 py-1 text-[11px] text-ink-dim"
      />
      <input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        disabled={pending}
        className="focus-ring w-[82px] shrink-0 rounded-ui border border-line bg-canvas px-1 py-1 text-[11px] text-ink-dim"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim()}
        className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft text-[13px] text-ink disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}

// "Extras de hoy" de un bloque — tasks sueltas (ver lib/plan/extras.ts)
// que viven SOLO ese día, debajo del árbol de hábitos permanentes. No
// cuentan para completar el bloque ni para la racha — se marcan/aplazan/
// borran independiente de todo lo demás.
export function ExtrasSection({ date, blockId, extras: initialExtras }: { date: string; blockId: string; extras: PlanExtra[] }) {
  const [extras, setExtras] = useState(initialExtras);

  useEffect(() => setExtras(initialExtras), [initialExtras]);

  function onToggled(id: string, done: boolean) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, done } : e)));
  }

  function onRemoved(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function onAdded(extra: PlanExtra) {
    setExtras((prev) => [...prev, extra]);
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {extras.length > 0 && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Extras de hoy ({extras.filter((e) => e.done).length}/{extras.length})
          </div>
          {extras.map((e) => (
            <ExtraRow key={e.id} extra={e} date={date} onToggled={onToggled} onRemoved={onRemoved} />
          ))}
        </>
      )}
      <AddExtraForm date={date} blockId={blockId} onAdded={onAdded} />
    </div>
  );
}
