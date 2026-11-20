"use client";

import { useEffect, useRef, useState } from "react";

// Pila global de modales (BottomSheetModal) — un solo módulo compartido
// por TODA la app, no un Context: no importa en qué rama del árbol React
// viva cada modal, lo único que cuenta es el orden real en que se
// abrieron. Sin esto, abrir el "⋯" de un hábito DENTRO de la hoja
// "Hábitos (x/y)" competía con ella por Esc/clic afuera/foco — ahora solo
// el de más arriba reacciona a eso; los de abajo quedan inertes (pero
// visibles) mientras haya uno encima.
let stack: symbol[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function push(id: symbol) {
  stack = [...stack, id];
  notify();
}

function pop(id: symbol) {
  stack = stack.filter((s) => s !== id);
  notify();
}

let scrollLockCount = 0;
let savedBodyOverflow: string | null = null;

function lockScroll() {
  scrollLockCount++;
  if (scrollLockCount === 1 && typeof document !== "undefined") {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0 && typeof document !== "undefined") {
    document.body.style.overflow = savedBodyOverflow ?? "";
    savedBodyOverflow = null;
  }
}

// Se registra en la pila global mientras `open` sea true (y bloquea el
// scroll del body — se destraba solo cuando se cierra el último modal
// abierto, sin importar cuántos haya). Devuelve si ESTE modal es el de
// más arriba (el único que debe escuchar Esc/clic afuera/atrapar foco) y
// su profundidad (para el z-index: más arriba en la pila = más alto).
export function useModalStackEntry(open: boolean): { isTop: boolean; depth: number } {
  const idRef = useRef<symbol | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    idRef.current = id;
    push(id);
    lockScroll();
    return () => {
      pop(id);
      unlockScroll();
      idRef.current = null;
    };
  }, [open]);

  const id = idRef.current;
  const depth = id !== null ? stack.indexOf(id) : -1;
  const isTop = depth !== -1 && depth === stack.length - 1;
  return { isTop, depth: Math.max(0, depth) };
}

// Para AutoRefresh: no refrescar mientras haya un modal abierto (puede
// tener un campo a mitad de editar) — consulta síncrona, sin suscripción,
// AutoRefresh ya reintenta por su cuenta hasta que esto vuelva a false.
export function isAnyModalOpen(): boolean {
  return stack.length > 0;
}
