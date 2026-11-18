"use client";

import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { setCheck, type SetCheckResult } from "./actions";
import { toggleLogToday } from "../habitos/actions";
import { pickHabitPraise } from "@/lib/habits/praise";
import {
  pickBlockPraise,
  streakMilestoneCrossed,
  pickStreakMilestoneMessage,
  pickProtectorGainedMessage,
} from "@/lib/plan/praise";

export type SubHabit = { activityId: string; name: string; done: boolean };

function usePlanToast() {
  const toast = useToast();
  return (result: unknown) => {
    if (!result || typeof result !== "object") return;
    const r = result as SetCheckResult;
    if (!r.done) return;
    const milestone = streakMilestoneCrossed(r.streakBefore, r.streakAfter);
    if (milestone) {
      toast.show({ message: pickStreakMilestoneMessage(milestone), tone: "success" });
    } else if (r.protectorsAfter > r.protectorsBefore) {
      toast.show({ message: pickProtectorGainedMessage(), tone: "success" });
    } else {
      toast.show({ message: pickBlockPraise(r), tone: "success" });
    }
  };
}

// Checkbox principal de un bloque — ✓ hecho / ✗ saltado, con toast de
// felicitación/racha. Usado en la grilla de escritorio y en la lista móvil
// (ver `compact`, que cambia solo el tamaño).
export function PlanCheckButton({
  date,
  blockId,
  isDone,
  className,
  children,
}: {
  date: string;
  blockId: string;
  isDone: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const onResult = usePlanToast();
  return (
    <SafeActionButton action={setCheck} fields={{ date, blockId, status: isDone ? "" : "done" }} onResult={onResult} className={className}>
      {children}
    </SafeActionButton>
  );
}

export function PlanSkipButton({
  date,
  blockId,
  isSkipped,
  className,
  children,
}: {
  date: string;
  blockId: string;
  isSkipped: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const onResult = usePlanToast();
  return (
    <SafeActionButton
      action={setCheck}
      fields={{ date, blockId, status: isSkipped ? "" : "skipped" }}
      onResult={onResult}
      className={className}
    >
      {children}
    </SafeActionButton>
  );
}

// Desplegable de subhábitos — todos menos el principal (el que comparte
// nombre con el bloque). Cada uno se marca aparte con toggleLogToday, sin
// afectar el check del bloque.
export function SubHabitsDropdown({ date, subHabits }: { date: string; subHabits: SubHabit[] }) {
  const toast = useToast();
  if (subHabits.length === 0) return null;

  function onHabitResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; isPrincipal: boolean; allPrincipalDone: boolean };
    if (!r.done) return;
    toast.show({ message: pickHabitPraise(r), tone: "success" });
  }

  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">
        Subhábitos ({subHabits.filter((h) => h.done).length}/{subHabits.length})
      </summary>
      <div className="mt-1 flex flex-col gap-1">
        {subHabits.map((h) => (
          <SafeActionButton
            key={h.activityId}
            action={toggleLogToday}
            fields={{ activityId: h.activityId, date }}
            onResult={onHabitResult}
            className="focus-ring flex items-center gap-2 rounded-ui py-1 text-left transition-colors duration-120 hover:bg-surface-2"
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
                h.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={`text-[12px] ${h.done ? "text-ink-dim line-through" : "text-ink"}`}>{h.name}</span>
          </SafeActionButton>
        ))}
      </div>
    </details>
  );
}
