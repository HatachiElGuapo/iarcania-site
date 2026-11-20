"use client";

import { useEffect } from "react";

// Contador global de "no refresques ahora" — igual que modal-stack.ts, un
// módulo compartido en vez de Context: no importa en qué rama del árbol
// viva cada componente ocupado, solo si HAY alguno. Lo usan
// SafeActionButton (mientras su acción está pendiente — cubre "acción
// optimista pendiente" en casi toda la app, un solo lugar) y HabitTreeDnd
// (mientras hay un arrastre en curso o persistiéndose). AutoRefresh
// consulta isBusy() antes de llamar router.refresh() y reintenta hasta
// que vuelva a false, para no pisarle al usuario lo que está haciendo.
let busyCount = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function isBusy(): boolean {
  return busyCount > 0;
}

export function subscribeBusy(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBusyGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    busyCount++;
    notify();
    return () => {
      busyCount = Math.max(0, busyCount - 1);
      notify();
    };
  }, [active]);
}
