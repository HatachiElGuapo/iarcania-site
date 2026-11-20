"use client";

import { useEffect, useState } from "react";

// Bloques flexibles (ej. Almuerzo) en "Tu día" — plegados por defecto,
// recordado por bloque en localStorage (igual que el colapso de
// habit-tree-dnd.tsx). Al completarse se pliegan solos una vez (la
// transición a `done`, no un candado permanente): un toggle manual
// posterior sigue pudiendo volver a abrirlos para revisar.
const STORAGE_KEY = "iarcania.plan.flexibleBlock.collapsed";

function loadMap(): Record<string, boolean> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, boolean>) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage no disponible — se pierde el recuerdo, no rompe nada.
  }
}

export function useFlexibleBlockCollapse(blockId: string, done: boolean): { open: boolean; toggle: () => void } {
  // null hasta que el efecto lee localStorage — arranca plegado en el
  // primer render (server y cliente coinciden, sin parpadeo de hidratación).
  const [stored, setStored] = useState<boolean | null>(null);
  const [forcedByDone, setForcedByDone] = useState(false);

  useEffect(() => {
    setStored(loadMap()[blockId] ?? true);
  }, [blockId]);

  useEffect(() => {
    if (done) setForcedByDone(true);
  }, [done]);

  const collapsed = forcedByDone ? true : stored ?? true;
  const open = !collapsed;

  function toggle() {
    setForcedByDone(false);
    const next = !open;
    setStored(!next);
    const map = loadMap();
    map[blockId] = !next;
    saveMap(map);
  }

  return { open, toggle };
}
