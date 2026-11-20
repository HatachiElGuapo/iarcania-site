"use client";

import { useEffect, useState, useTransition, type FocusEvent } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { saveFocusSlot } from "./actions";
import { createTask, toggleTaskStatus, rescheduleTask } from "../actividades/actions";
import { CompactModalCard } from "../compact-modal-card";
import { useActionsModal } from "./actions-context";
import { addDaysISO } from "@/lib/date/bogota";
import type { FocusSlot, OtherAction } from "@/lib/trabajo/daily-actions";

export type DayActions = { date: string; focus: FocusSlot[]; others: OtherAction[] };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Propuesta de fin cuando solo se puso inicio: +1h, recortada a 23:59
// para no cruzar de día (el usuario puede editarla antes de guardar).
function plusOneHour(hhmm: string): string {
  const total = Math.min(23 * 60 + 59, toMinutes(hhmm) + 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function isRangeValid(timeDue: string, timeEnd: string): boolean {
  if (!timeDue || !timeEnd) return true;
  return toMinutes(timeEnd) > toMinutes(timeDue);
}

function fmtRange(timeDue: string | null, timeEnd: string | null): string | null {
  if (!timeDue) return null;
  return timeEnd ? `de ${timeDue} a ${timeEnd}` : timeDue;
}

function filledCount(focus: FocusSlot[]) {
  return focus.filter((f) => f.title.trim() !== "").length;
}

function doneCount(focus: FocusSlot[]) {
  return focus.filter((f) => f.taskId && f.done).length;
}

// Un campo fijo "Acción N" — texto + rango de hora opcional, se guarda en
// línea (blur o Enter). Al escribir la hora de inicio sin tener fin
// todavía, propone fin = inicio + 1h (editable antes de guardar). El
// checkbox solo existe una vez que el slot tiene una task detrás
// (taskId), reusa toggleTaskStatus tal cual.
export function FocusSlotRow({
  slot,
  date,
  onSaved,
  onToggled,
}: {
  slot: FocusSlot;
  date: string;
  onSaved: (rank: number, title: string, timeDue: string | null, timeEnd: string | null) => void;
  onToggled: (rank: number, done: boolean) => void;
}) {
  const [title, setTitle] = useState(slot.title);
  const [timeDue, setTimeDue] = useState(slot.timeDue ?? "");
  const [timeEnd, setTimeEnd] = useState(slot.timeEnd ?? "");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => {
    setTitle(slot.title);
    setTimeDue(slot.timeDue ?? "");
    setTimeEnd(slot.timeEnd ?? "");
  }, [slot.title, slot.timeDue, slot.timeEnd]);

  function onStartChange(value: string) {
    setTimeDue(value);
    if (value && !timeEnd) setTimeEnd(plusOneHour(value));
  }

  function save() {
    if (
      title.trim() === slot.title.trim() &&
      (timeDue || null) === slot.timeDue &&
      (timeEnd || null) === slot.timeEnd
    ) {
      return;
    }
    if (!isRangeValid(timeDue, timeEnd)) {
      toast.show({ message: "La hora de fin debe ser mayor que la de inicio.", tone: "error" });
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("date", date);
        fd.set("rank", String(slot.rank));
        fd.set("title", title);
        fd.set("timeDue", timeDue);
        fd.set("timeEnd", timeEnd);
        await saveFocusSlot(fd);
        onSaved(slot.rank, title.trim(), timeDue || null, timeEnd || null);
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo guardar.", tone: "error" });
      }
    });
  }

  function onToggleResult() {
    onToggled(slot.rank, !slot.done);
  }

  function onBlurSave(e: FocusEvent<HTMLDivElement>) {
    // Solo guarda cuando el foco se va del grupo entero (texto+horas),
    // no entre sus propios campos — si no, cada Tab entre inicio/fin
    // dispararía un guardado a mitad de editar el rango.
    if (!e.currentTarget.contains(e.relatedTarget)) save();
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-ui border border-line bg-surface px-2.5 py-2"
      onBlur={onBlurSave}
    >
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Escribí la acción…"
        disabled={pending}
        className={`focus-ring min-w-[120px] flex-1 rounded-ui border border-transparent bg-transparent px-1.5 py-1 text-[14px] ${
          slot.done ? "text-ink-dim line-through" : "text-ink"
        }`}
      />
      <div className="flex shrink-0 items-center gap-1 text-[11px] text-ink-dim">
        <span>de</span>
        <input
          type="time"
          value={timeDue}
          onChange={(e) => onStartChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          disabled={pending}
          className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
        />
        <span>a</span>
        <input
          type="time"
          value={timeEnd}
          onChange={(e) => setTimeEnd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          disabled={pending}
          className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
        />
      </div>
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

  const range = fmtRange(action.timeDue, action.timeEnd);

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
        {range && <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">{range}</span>}
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
  const [timeEnd, setTimeEnd] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function onStartChange(value: string) {
    setTimeDue(value);
    if (value && !timeEnd) setTimeEnd(plusOneHour(value));
  }

  function submit() {
    if (!title.trim()) return;
    if (!isRangeValid(timeDue, timeEnd)) {
      toast.show({ message: "La hora de fin debe ser mayor que la de inicio.", tone: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("dueDate", date);
    if (timeDue) fd.set("timeDue", timeDue);
    if (timeEnd) fd.set("timeEnd", timeEnd);
    startTransition(async () => {
      try {
        await createTask(fd);
        onAdded({
          id: crypto.randomUUID(),
          title: title.trim(),
          timeDue: timeDue || null,
          timeEnd: timeEnd || null,
          done: false,
        });
        setTitle("");
        setTimeDue("");
        setTimeEnd("");
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
        placeholder="+ agregar otra acción…"
        disabled={pending}
        className="focus-ring min-w-[140px] flex-1 rounded-ui border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-dim"
      />
      <div className="flex shrink-0 items-center gap-1 text-[11px] text-ink-dim">
        <span>de</span>
        <input
          type="time"
          value={timeDue}
          onChange={(e) => onStartChange(e.target.value)}
          disabled={pending}
          className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
        />
        <span>a</span>
        <input
          type="time"
          value={timeEnd}
          onChange={(e) => setTimeEnd(e.target.value)}
          disabled={pending}
          className="focus-ring w-[92px] rounded-ui border border-line bg-canvas px-1.5 py-1 text-[12px] text-ink-dim"
        />
      </div>
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
  function onSlotSaved(rank: number, title: string, timeDue: string | null, timeEnd: string | null) {
    onChange({
      ...day,
      focus: day.focus.map((f) =>
        f.rank === rank ? { ...f, title, timeDue, timeEnd, taskId: f.taskId ?? "pending" } : f,
      ),
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

// Vista en línea de las 3 acciones principales de hoy — para el tope de
// la sección "Tu día" (destacada), sin abrir ningún modal: mismo
// FocusSlotRow/saveFocusSlot que usa ActionsCard, con su propio estado
// local resincronizado con las props (igual que ActionsCard). El "+
// Acción" de acá abre el mismo modal compartido (useActionsModal), en la
// pestaña "Hoy".
export function TodayFocusList({ focus: initialFocus, date }: { focus: FocusSlot[]; date: string }) {
  const { openModal } = useActionsModal();
  const [focus, setFocus] = useState(initialFocus);

  useEffect(() => setFocus(initialFocus), [initialFocus]);

  function onSlotSaved(rank: number, title: string, timeDue: string | null, timeEnd: string | null) {
    setFocus((prev) =>
      prev.map((f) => (f.rank === rank ? { ...f, title, timeDue, timeEnd, taskId: f.taskId ?? "pending" } : f)),
    );
  }

  function onSlotToggled(rank: number, done: boolean) {
    setFocus((prev) => prev.map((f) => (f.rank === rank ? { ...f, done } : f)));
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-line bg-surface-sunken px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Las 3 de hoy</span>
        <button type="button" onClick={() => openModal("hoy")} className="text-meta text-accent hover:underline">
          + Acción
        </button>
      </div>
      {focus.map((slot) => (
        <FocusSlotRow key={slot.rank} slot={slot} date={date} onSaved={onSlotSaved} onToggled={onSlotToggled} />
      ))}
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
