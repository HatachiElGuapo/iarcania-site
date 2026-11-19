"use client";

import { useEffect, useState } from "react";
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

// Versión móvil de SubHabitsDropdown (block-check.tsx) — mismo
// HabitTreeDnd/ExtrasSection de escritorio (checkbox con cascada, ▸/▾ por
// nivel, ⋯, asa ⠿ con TouchSensor), pero CERRADA por defecto y con un
// botón propio de zona táctil de 44px en vez del <details open> de
// escritorio — en una pantalla chica, mostrar siempre el árbol completo
// de cada bloque hace que las tarjetas midan todas distinto. El
// abierto/cerrado se recuerda por bloque en localStorage.
export function MobileSubHabits({
  date,
  blockId,
  subHabits,
  extras = [],
}: {
  date: string;
  blockId: string;
  subHabits: HabitNode[];
  extras?: PlanExtra[];
}) {
  const [open, setOpen] = useState(false);
  const storageKey = `plan.mobileTree.open.${blockId}`;

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) === "1");
    } catch {
      // localStorage no disponible — queda cerrada (el valor por defecto).
    }
  }, [storageKey]);

  if (subHabits.length === 0 && extras.length === 0) return null;
  const { done, total } = countDeep(subHabits);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Sin persistencia disponible — igual funciona para esta sesión.
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="focus-ring flex min-h-11 items-center gap-1 self-start rounded-ui px-1 text-[12px] text-ink-dim"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">{open ? "▾" : "▸"}</span>
        <span>
          Hábitos ({done}/{total})
        </span>
      </button>
      {open && (
        <div className="rounded-ui border border-line bg-surface-sunken p-1.5">
          {subHabits.length > 0 && <HabitTreeDnd date={date} blockId={blockId} subHabits={subHabits} />}
          <ExtrasSection date={date} blockId={blockId} extras={extras} />
        </div>
      )}
    </div>
  );
}
