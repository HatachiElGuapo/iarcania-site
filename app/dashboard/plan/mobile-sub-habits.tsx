"use client";

import { useRef, useState } from "react";
import { BottomSheetModal } from "../compact-modal-card";
import { HabitTreeDnd } from "./habit-tree-dnd";
import { ExtrasSection } from "./extras-section";
import type { HabitNode } from "@/lib/plan/sub-habits";
import type { PlanExtra } from "@/lib/plan/extras";

function countDeep(nodes: HabitNode[]): { done: number; total: number } {
  return nodes.reduce(
    (acc, n) => {
      const child = countDeep(n.children);
      return { done: acc.done + (n.done ? 1 : 0) + child.done, total: acc.total + 1 + child.total };
    },
    { done: 0, total: 0 },
  );
}

// Versión móvil de SubHabitsDropdown (block-check.tsx) — en vez de
// desplegar el árbol DENTRO de la lista (eso hacía que cada tarjeta
// cambiara de alto y tapara a la de abajo), el botón "Hábitos (x/y)" abre
// una hoja inferior a pantalla completa (mismo BottomSheetModal que
// Hábitos/Secundarios) con el árbol completo — mismo HabitTreeDnd/
// ExtrasSection de escritorio: checkbox con cascada, verde, ▸/▾ por
// nivel, ⋯, asa ⠿ con TouchSensor. Al cerrar, el conteo "x/y" del botón
// se actualiza solo con las props nuevas que trae el router.refresh()
// que ya dispara cualquier acción adentro (toggleLogToday, etc.) — sin
// recargar la página.
export function MobileSubHabits({
  date,
  blockId,
  blockText,
  subHabits,
  extras = [],
}: {
  date: string;
  blockId: string;
  blockText: string;
  subHabits: HabitNode[];
  extras?: PlanExtra[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (subHabits.length === 0 && extras.length === 0) return null;
  const { done, total } = countDeep(subHabits);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="focus-ring flex min-h-11 items-center gap-1 self-start rounded-ui px-1 text-[12px] text-ink-dim"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">▸</span>
        <span>
          Hábitos ({done}/{total})
        </span>
      </button>
      <BottomSheetModal open={open} onOpenChange={setOpen} title={blockText} returnFocusRef={triggerRef}>
        <div className="p-1.5">
          {subHabits.length > 0 && <HabitTreeDnd date={date} blockId={blockId} subHabits={subHabits} />}
          <ExtrasSection date={date} blockId={blockId} extras={extras} />
        </div>
      </BottomSheetModal>
    </>
  );
}
