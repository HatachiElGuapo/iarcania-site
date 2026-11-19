"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "dashboard.habits.open";

// Tarjeta compacta de "Hábitos" — cerrada por defecto (recordado en
// localStorage), muestra solo la racha del Plan + protectores y el
// progreso de hoy. Al tocarla despliega la lista completa (children, ya
// armada por quien llama — mismo orden/funciones de siempre, esto solo
// decide si se ve o no).
export function HabitsCard({
  streak,
  protectors,
  doneToday,
  total,
  children,
}: {
  streak: number;
  protectors: number;
  doneToday: number;
  total: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage no disponible (SSR, modo privado, etc.) — queda cerrada.
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Sin persistencia disponible — igual funciona para esta sesión.
    }
  }

  return (
    <section className="overflow-hidden rounded-ui-lg border border-line bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="focus-ring flex w-full items-center justify-between gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-ink-dim">{open ? "▾" : "▸"}</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Hábitos</span>
        </span>
        <span className="flex items-center gap-3 text-meta text-ink-dim">
          <span className="tabular-nums">
            🔥 {streak} día{streak === 1 ? "" : "s"}
            {protectors > 0 && ` · 🛡️ ${protectors}`}
          </span>
          <span className="tabular-nums">
            {doneToday}/{total} hábitos
          </span>
        </span>
      </button>
      {open && <div className="border-t border-line">{children}</div>}
    </section>
  );
}
