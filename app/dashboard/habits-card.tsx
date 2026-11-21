"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { Badge, EmptyState, Input } from "@/components/ui";
import { QuickAddPanel } from "@/components/ui/quick-add-panel";
import { SafeActionButton } from "./safe-action-button";
import { useBusyGuard } from "./busy-guard";
import { toggleLogToday, createActivity, adjustCounter } from "./habitos/actions";
import { CompactModalCard } from "./compact-modal-card";
import { STREAK_MILESTONES } from "@/lib/plan/praise";
import { HabitIcon } from "@/lib/icons/habit-icons";

export type HabitViewItem = {
  id: string;
  name: string;
  horaSugerida: string | null;
  icon: string | null;
  targetValue: number | null;
  unit: string | null;
  countSteps: number[] | null;
  currentValue: number;
  done: boolean;
  weeklyTarget: number | null;
  weekCount: number;
  weekStreak: number;
  streak: number;
  week: { done: boolean }[];
};

// Tras un deploy, el bundle viejo referencia Server Actions que el server
// nuevo ya no conoce — recargar trae el bundle nuevo con las acciones
// correctas (mismo tratamiento que en habit-tree-dnd.tsx).
function isStaleServerActionError(err: unknown): boolean {
  return err instanceof Error && /Failed to find Server Action/i.test(err.message);
}

// Botones grandes +N/−N de un hábito con meta ("1000 saltos") — mismo
// patrón que CounterControls en plan/habit-tree-dnd.tsx, acá para hábitos
// de primer nivel (fuera de un bloque de Plan).
function CounterControls({
  h,
  date,
  onChanged,
}: {
  h: HabitViewItem;
  date: string;
  onChanged: (id: string, value: number, done: boolean, toastMessage: string | null) => void;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  useBusyGuard(pending);
  const steps = h.countSteps && h.countSteps.length > 0 ? h.countSteps : [100];

  async function adjust(delta: number) {
    setPending(true);
    try {
      const result = await adjustCounter({ activityId: h.id, date, delta });
      onChanged(h.id, result.value, result.done, result.toastMessage);
    } catch (err) {
      if (isStaleServerActionError(err)) {
        toast.show({ message: "Hay una versión nueva, recargando…", tone: "error" });
        window.location.reload();
        return;
      }
      toast.show({ message: err instanceof Error ? err.message : "No se pudo actualizar.", tone: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => adjust(-steps[0])}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-ui border border-line bg-surface px-3 text-[13px] font-medium text-ink-dim disabled:opacity-50"
      >
        −{steps[0]}
      </button>
      {steps.map((step) => (
        <button
          key={step}
          type="button"
          disabled={pending}
          onClick={() => adjust(step)}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft px-3 text-[13px] font-medium text-ink disabled:opacity-50"
        >
          +{step}
        </button>
      ))}
    </div>
  );
}

function HabitRow({
  h,
  date,
  onToggled,
  onCounterChanged,
}: {
  h: HabitViewItem;
  date: string;
  onToggled: (id: string, done: boolean) => void;
  onCounterChanged: (id: string, value: number, done: boolean, toastMessage: string | null) => void;
}) {
  const toast = useToast();

  function onResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    onToggled(h.id, r.done);
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

  function onCounterResult(id: string, value: number, done: boolean, toastMessage: string | null) {
    onCounterChanged(id, value, done, toastMessage);
    if (toastMessage) toast.show({ message: toastMessage, tone: "success" });
  }

  if (h.targetValue != null) {
    return (
      <div className="flex w-full flex-col gap-1.5 rounded-ui-lg border border-line bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <SafeActionButton
            action={toggleLogToday}
            fields={{ activityId: h.id, date }}
            onResult={onResult}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              h.done ? "border-accent bg-accent text-white" : "border-line-strong"
            }`}
          >
            {h.done ? "✓" : ""}
          </SafeActionButton>
          <HabitIcon icon={h.icon} className="h-4 w-4 shrink-0 text-ink-dim" />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${h.done ? "text-ink-dim line-through" : "text-ink"}`}>{h.name}</span>
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-dim">
            {h.currentValue}/{h.targetValue}
            {h.unit ? ` ${h.unit}` : ""}
          </span>
          <Badge tone="warm">🔥 {h.streak}</Badge>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent-warm"
            style={{ width: `${Math.min(100, (h.currentValue / h.targetValue) * 100)}%` }}
          />
        </div>
        <CounterControls h={h} date={date} onChanged={onCounterResult} />
      </div>
    );
  }

  return (
    <SafeActionButton
      action={toggleLogToday}
      fields={{ activityId: h.id, date }}
      onResult={onResult}
      className="focus-ring flex w-full items-center gap-2.5 rounded-ui-lg border border-line bg-surface px-3.5 py-2.5 text-left transition-colors duration-120 hover:border-line-strong"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
          h.done ? "border-accent bg-accent text-white" : "border-line-strong"
        }`}
      >
        {h.done ? "✓" : ""}
      </span>
      <HabitIcon icon={h.icon} className="h-4 w-4 shrink-0 text-ink-dim" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${h.done ? "text-ink-dim line-through" : "text-ink"}`}>{h.name}</span>
        <span className="mt-0.5 block truncate text-[10px] text-ink-dim">{h.horaSugerida ?? "cualquier hora"}</span>
      </span>
      {h.weeklyTarget != null ? (
        <>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
            {h.weekCount}/{h.weeklyTarget} esta semana
          </span>
          <Badge tone="warm">🔥 {h.weekStreak}</Badge>
        </>
      ) : (
        <>
          <span className="flex shrink-0 gap-[2px]">
            {h.week.map((c, i) => (
              <span key={i} className={`h-3.5 w-[7px] rounded-[2px] ${c.done ? "bg-success/25" : "bg-surface-2"}`} />
            ))}
          </span>
          <Badge tone="warm">🔥 {h.streak}</Badge>
        </>
      )}
    </SafeActionButton>
  );
}

// Tarjeta compacta "Hábitos" — en reposo solo 🔥 racha del Plan +
// protectores y "X/Y hábitos" de hoy. Al tocarla abre un modal (mismo
// shell que SecondaryCard, CompactModalCard) con: arriba, racha
// actual/mejor racha/protectores y los próximos hitos de racha (3/7/14/
// 21/30/60/100 — ver lib/plan/praise.ts) con cuánto falta; debajo, la
// lista completa de hábitos de hoy, mismo orden/funciones de siempre
// (toggleLogToday, "Ver rachas →", "+ Nuevo hábito"). El estado local
// (habitsView) se resincroniza con las props en cada render del server
// y se actualiza al toque al marcar, sin esperar el router.refresh().
export function HabitsCard({
  streak,
  best,
  protectors,
  habitsView: initialHabitsView,
  date,
}: {
  streak: number;
  best: number;
  protectors: number;
  habitsView: HabitViewItem[];
  date: string;
}) {
  const [habitsView, setHabitsView] = useState(initialHabitsView);

  useEffect(() => {
    setHabitsView(initialHabitsView);
  }, [initialHabitsView]);

  function onToggled(id: string, done: boolean) {
    setHabitsView((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
  }

  function onCounterChanged(id: string, value: number, done: boolean) {
    setHabitsView((prev) => prev.map((h) => (h.id === id ? { ...h, currentValue: value, done } : h)));
  }

  const doneToday = habitsView.filter((h) => h.done).length;
  const total = habitsView.length;

  return (
    <CompactModalCard
      label="Hábitos"
      title="Hábitos"
      summary={
        <>
          <span className="tabular-nums">
            🔥 {streak} día{streak === 1 ? "" : "s"}
            {protectors > 0 && ` · 🛡️ ${protectors}`}
          </span>
          <span className="tabular-nums">
            {doneToday}/{total} hábitos
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-3.5">
        <div className="grid grid-cols-3 gap-2 rounded-ui border border-line bg-surface px-3 py-2.5 text-center">
          <div>
            <div className="font-display text-[18px] font-bold text-ink">{streak}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted">racha actual</div>
          </div>
          <div>
            <div className="font-display text-[18px] font-bold text-ink">{best}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted">mejor racha</div>
          </div>
          <div>
            <div className="font-display text-[18px] font-bold text-ink">{protectors}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted">protectores</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STREAK_MILESTONES.map((m) => {
            const reached = streak >= m;
            return (
              <span
                key={m}
                className={`rounded-full border px-2 py-0.5 text-[10.5px] ${
                  reached ? "border-accent/40 bg-accent-soft text-ink" : "border-line text-ink-dim"
                }`}
              >
                {m} días{!reached && ` · faltan ${m - streak}`}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent-warm"
              style={{ width: total ? `${Math.round((doneToday / total) * 100)}%` : "0%" }}
            />
          </div>
          <Link href="/dashboard/habitos/rachas" className="shrink-0 text-meta text-accent hover:underline">
            Ver rachas →
          </Link>
        </div>

        <div className="flex flex-col gap-1.5">
          {habitsView.length === 0 ? (
            <EmptyState icon="🔥">Aún no sigues ningún hábito diario — creá el primero abajo.</EmptyState>
          ) : (
            habitsView.map((h) => (
              <HabitRow key={h.id} h={h} date={date} onToggled={onToggled} onCounterChanged={onCounterChanged} />
            ))
          )}
        </div>

        <div className="border-t border-line pt-2.5">
          <QuickAddPanel
            trigger={<button className="text-meta text-accent hover:underline">+ Nuevo hábito</button>}
            title="Nuevo hábito"
            action={createActivity}
            name="name"
            placeholder="Nombre del hábito…"
            hidden={{ frequency: "diaria" }}
            extras={<Input type="time" name="horaSugerida" />}
          />
        </div>
      </div>
    </CompactModalCard>
  );
}
