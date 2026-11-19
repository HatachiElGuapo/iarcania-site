"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { saveFocusSlot } from "./actions";
import { createTask, toggleTaskStatus, rescheduleTask } from "../actividades/actions";
import { CompactModalCard } from "../compact-modal-card";
import { useActionsModal } from "./actions-context";
import { addDaysISO } from "@/lib/date/bogota";
import type { FocusSlot, OtherAction } from "@/lib/trabajo/daily-actions";

export type DayActions = { date: string; focus: FocusSlot[]; others: OtherAction[] };

function filledCount(focus: FocusSlot[]) {
  return focus.filter((f) => f.title.trim() !== "").length;
}

function doneCount(focus: FocusSlot[]) {
  return focus.filter((f) => f.taskId && f.done).length;
}

// Un campo fijo "Acción N" — texto + hora opcional, se guardan en línea
// (blur o Enter). El checkbox solo existe una vez que el slot tiene una
// task detrás (taskId), reusa toggleTaskStatus tal cual.
function FocusSlotRow({
  slot,
  date,
  onSaved,
  onToggled,
}: {
  slot: FocusSlot;
  date: string;
  onSaved: (rank: number, title: string, timeDue: string | null) => void;
  onToggled: (rank: number, done: boolean) => void;
}) {
  const [title, setTitle] = useState(slot.title);
  const [timeDue, setTimeDue] = useState(slot.timeDue ?? "");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    setTitle(slot.title);
    setTimeDue(slot.timeDue ?? "");
  }, [slot.title, slot.timeDue]);

  function save() {
    if (title.trim() === slot.title.trim() && (timeDue || null) === slot.timeDue) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("date", date);
        fd.set("rank", String(slot.rank));
        fd.set("title", title);
        fd.set("timeDue", timeDue);
        await saveFocusSlot(fd);
        onSaved(slot.rank, title.trim(), timeDue || null);
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo guardar.", tone: "error" });
      }
    });
  }

  function onToggleResult() {
    onToggled(slot.rank, !slot.done);
  }

  return (
    <div className="flex items-center gap-2 rounded-ui border border-line bg-surface px-2.5 py-2">
      {slot.taskId ? (
        <SafeActionButton
          action={toggleTaskStatus}
          fields={{ id: slot.taskId, nextStatus: slot.done ? "pendiente" : "completada" }}
          onResult={onToggleResult}
          className="focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
              slot.done ? "border-accent bg-accent text-white" : "border-line-strong"
            }`}
          >
            {slot.done ? "✓" : ""}
          </span>
        </SafeActionButton>
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-line-strong opacity-40" />
      )}
      <span className="w-[62px] shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">
        Acción {slot.rank + 1}
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Escribí la acción…"
        disabled={pending}
        className={`focus-ring min-w-0 flex-1 rounded-ui border border-transparent bg-transparent px-1.5 py-1 text-[14px] ${
          slot.done ? "text-ink-dim line-through" : "text-ink"
        }`}
      />
      <input
        type="time"
        value={timeDue}
        onChange={(e) => setTimeDue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={pending}
        className="focus-ring w-[92px] shrink-0 rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
      />
    </div>
  );
}

function OtherActionRow({
  action,
  date,
  onToggled,
  onDeferred,
}: {
  action: OtherAction;
  date: string;
  onToggled: (id: string, done: boolean) => void;
  onDeferred: (id: string) => void;
}) {
  const toast = useToast();

  function onToggleResult() {
    onToggled(action.id, !action.done);
  }

  function onDeferResult() {
    onDeferred(action.id);
    toast.show({ message: "Aplazada a mañana.", tone: "success" });
  }

  return (
    <div className="flex items-center gap-2 rounded-ui border border-line bg-surface px-2.5 py-1.5">
      <SafeActionButton
        action={toggleTaskStatus}
        fields={{ id: action.id, nextStatus: action.done ? "pendiente" : "completada" }}
        onResult={onToggleResult}
        className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-ui py-0.5 text-left"
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
            action.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
          }`}
        >
          ✓
        </span>
        {action.timeDue && <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">{action.timeDue}</span>}
        <span className={`min-w-0 truncate text-[13px] ${action.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {action.title}
        </span>
      </SafeActionButton>
      <SafeActionButton
        action={rescheduleTask}
        fields={{ id: action.id, dueDate: addDaysISO(date, 1) }}
        onResult={onDeferResult}
        className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-ui border border-line text-[12px] text-ink-dim hover:border-line-strong hover:text-ink"
      >
        {"⏭︎"}
      </SafeActionButton>
    </div>
  );
}

function QuickAddOther({ date, onAdded }: { date: string; onAdded: (action: OtherAction) => void }) {
  const [title, setTitle] = useState("");
  const [timeDue, setTimeDue] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("dueDate", date);
    if (timeDue) fd.set("timeDue", timeDue);
    startTransition(async () => {
      try {
        await createTask(fd);
        onAdded({ id: crypto.randomUUID(), title: title.trim(), timeDue: timeDue || null, done: false });
        setTitle("");
        setTimeDue("");
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo agregar.", tone: "error" });
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="+ agregar otra acción…"
        disabled={pending}
        className="focus-ring min-w-0 flex-1 rounded-ui border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-dim"
      />
      <input
        type="time"
        value={timeDue}
        onChange={(e) => setTimeDue(e.target.value)}
        disabled={pending}
        className="focus-ring w-[92px] shrink-0 rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim()}
        className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft text-[14px] text-ink disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}

function DayTabContent({ day, onChange }: { day: DayActions; onChange: (next: DayActions) => void }) {
  function onSlotSaved(rank: number, title: string, timeDue: string | null) {
    onChange({
      ...day,
      focus: day.focus.map((f) => (f.rank === rank ? { ...f, title, timeDue, taskId: f.taskId ?? "pending" } : f)),
    });
  }

  function onSlotToggled(rank: number, done: boolean) {
    onChange({ ...day, focus: day.focus.map((f) => (f.rank === rank ? { ...f, done } : f)) });
  }

  function onOtherToggled(id: string, done: boolean) {
    onChange({ ...day, others: day.others.map((o) => (o.id === id ? { ...o, done } : o)) });
  }

  function onOtherDeferred(id: string) {
    onChange({ ...day, others: day.others.filter((o) => o.id !== id) });
  }

  function onOtherAdded(action: OtherAction) {
    onChange({ ...day, others: [...day.others, action] });
  }

  return (
    <div className="flex flex-col gap-4 p-3.5">
      <div className="flex flex-col gap-1.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Las 3 de hoy</div>
        {day.focus.map((slot) => (
          <FocusSlotRow key={slot.rank} slot={slot} date={day.date} onSaved={onSlotSaved} onToggled={onSlotToggled} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Otras acciones</div>
        <div className="flex flex-col gap-1.5">
          {day.others.map((a) => (
            <OtherActionRow key={a.id} action={a} date={day.date} onToggled={onOtherToggled} onDeferred={onOtherDeferred} />
          ))}
        </div>
        <QuickAddOther date={day.date} onAdded={onOtherAdded} />
      </div>
    </div>
  );
}

// Tarjeta compacta "Acciones" — en reposo "Hoy · X/3 hechas" y "Mañana ·
// Y/3 definidas". Comparte el modal (vía ActionsModalProvider/
// useActionsModal) con el botón "+ Acción" del encabezado — cualquiera
// de los dos abre el mismo diálogo.
export function ActionsCard({ hoy: initialHoy, manana: initialManana }: { hoy: DayActions; manana: DayActions }) {
  const { open, tab, setTab, close, openModal } = useActionsModal();
  const [hoy, setHoy] = useState(initialHoy);
  const [manana, setManana] = useState(initialManana);

  useEffect(() => setHoy(initialHoy), [initialHoy]);
  useEffect(() => setManana(initialManana), [initialManana]);

  const hoyDone = doneCount(hoy.focus);
  const mananaFilled = filledCount(manana.focus);

  return (
    <CompactModalCard
      label="Acciones"
      title="Acciones"
      open={open}
      onOpenChange={(v) => (v ? openModal(tab) : close())}
      summary={
        <>
          <span className="tabular-nums">Hoy · {hoyDone}/3 hechas</span>
          <span className="tabular-nums">Mañana · {mananaFilled}/3 definidas</span>
        </>
      }
    >
      <div className="flex shrink-0 gap-1 border-b border-line bg-surface px-3.5 pt-2.5">
        {(["hoy", "manana"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-ui px-3 py-1.5 text-[13px] font-medium ${
              tab === t ? "border-b-2 border-accent text-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            {t === "hoy" ? "Hoy" : "Mañana"}
          </button>
        ))}
      </div>
      {tab === "hoy" ? (
        <DayTabContent day={hoy} onChange={setHoy} />
      ) : (
        <DayTabContent day={manana} onChange={setManana} />
      )}
    </CompactModalCard>
  );
}
