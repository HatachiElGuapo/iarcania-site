"use client";

import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { setCheck, type SetCheckResult } from "./actions";
import { HabitTreeDnd } from "./habit-tree-dnd";
import type { HabitNode } from "@/lib/plan/sub-habits";
import {
  pickBlockPraise,
  streakMilestoneCrossed,
  pickStreakMilestoneMessage,
  pickProtectorGainedMessage,
} from "@/lib/plan/praise";

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

// Desplegable de hábitos de primer nivel de un bloque — TODOS, incluido el
// que comparte nombre con el bloque. Cada uno (y sus hijos/nietos) se
// marca aparte con toggleLogToday, sin afectar el check del bloque. El
// árbol en sí (sangría, línea guía, drag-and-drop) vive en HabitTreeDnd.
export function SubHabitsDropdown({
  date,
  blockId,
  subHabits,
}: {
  date: string;
  blockId: string;
  subHabits: HabitNode[];
}) {
  function countDeep(nodes: HabitNode[]): { done: number; total: number } {
    return nodes.reduce(
      (acc, n) => {
        const child = countDeep(n.children);
        return { done: acc.done + (n.done ? 1 : 0) + child.done, total: acc.total + 1 + child.total };
      },
      { done: 0, total: 0 },
    );
  }

  if (subHabits.length === 0) return null;
  const { done, total } = countDeep(subHabits);

  return (
    <details className="mt-1.5" open>
      <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">
        Hábitos ({done}/{total})
      </summary>
      <div className="mt-1.5 rounded-ui border border-line bg-surface-sunken p-1.5">
        <HabitTreeDnd date={date} blockId={blockId} subHabits={subHabits} />
      </div>
    </details>
  );
}
