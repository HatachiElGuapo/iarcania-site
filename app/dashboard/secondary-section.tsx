"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import type { HabitNode } from "@/lib/plan/sub-habits";
import type { SecondaryBand, SecondaryEntry } from "@/lib/plan/secondary";

const BAND_LABEL: Record<SecondaryBand, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };
const OPEN_STORAGE_KEY = "dashboard.secondary.open";

function SecondaryRow({ node, date, depth }: { node: HabitNode; date: string; depth: number }) {
  // Igual que el árbol del Plan: abierto si tiene hijos pendientes,
  // cerrado si ya está completo — sin persistencia acá (no es un árbol
  // arrastrable, es un recordatorio aparte, más simple).
  const [collapsed, setCollapsed] = useState(node.children.length > 0 && node.done);
  const toast = useToast();
  const hasChildren = node.children.length > 0;

  function onResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="w-[14px] shrink-0 border-l border-line" />
        ))}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir" : "Minimizar"}
            className="focus-ring flex h-5 w-4 shrink-0 items-center justify-center text-[10px] text-ink-dim hover:text-ink"
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <SafeActionButton
          action={toggleLogToday}
          fields={{ activityId: node.activityId, date }}
          onResult={onResult}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-ui py-0.5 text-left transition-colors duration-120 hover:bg-surface-2"
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
              node.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
            }`}
          >
            ✓
          </span>
          <span className={`min-w-0 truncate text-[12px] ${node.done ? "text-ink-dim line-through" : "text-ink"}`}>
            {node.name}
          </span>
        </SafeActionButton>
      </div>
      {hasChildren && !collapsed && (
        <div className="flex flex-col gap-0.5">
          {node.children.map((c) => (
            <SecondaryRow key={c.activityId} node={c} date={date} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SecondaryGroupEntry({ entry, date }: { entry: SecondaryEntry; date: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-ui border border-line bg-surface px-2 py-1.5">
      <div className="flex items-center gap-2 text-[10px] text-ink-dim">
        <span className="tabular-nums">{entry.dueTime}</span>
        <span className="truncate">· {entry.blockText}</span>
      </div>
      <SecondaryRow node={entry.node} date={date} depth={0} />
    </div>
  );
}

// Contenido en sí (encabezados de franja + árboles) — sin chrome propio,
// para poder usarlo tanto directo como children de un <Card> (escritorio)
// como adentro de un wrapper plegable (móvil).
export function SecondaryHabitsList({
  groups,
  date,
}: {
  groups: Record<SecondaryBand, SecondaryEntry[]>;
  date: string;
}) {
  const bands: SecondaryBand[] = ["manana", "tarde", "noche"];
  const total = bands.reduce((acc, b) => acc + groups[b].length, 0);
  if (total === 0) {
    return <p className="px-3.5 py-3 text-xs text-ink-muted">Sin secundarios pendientes hoy.</p>;
  }
  return (
    <div className="flex flex-col gap-3 p-3.5">
      {bands.map((band) =>
        groups[band].length === 0 ? null : (
          <div key={band} className="flex flex-col gap-1.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {BAND_LABEL[band]}
            </div>
            <div className="flex flex-col gap-1.5">
              {groups[band].map((entry) => (
                <SecondaryGroupEntry key={entry.node.activityId} entry={entry} date={date} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// Móvil: sección plegable, misma idea que <ReviewSection> pero por
// defecto abierta (a diferencia de "Por revisar", esto sí es accionable
// todos los días).
export function SecondaryHabitsMobileSection({
  groups,
  date,
}: {
  groups: Record<SecondaryBand, SecondaryEntry[]>;
  date: string;
}) {
  const [open, setOpen] = useState(true);
  const bands: SecondaryBand[] = ["manana", "tarde", "noche"];
  const total = bands.reduce((acc, b) => acc + groups[b].length, 0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(OPEN_STORAGE_KEY);
      if (stored !== null) setOpen(stored === "1");
    } catch {
      // localStorage no disponible — queda con el valor por defecto (abierta).
    }
  }, []);

  if (total === 0) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, next ? "1" : "0");
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
        className="focus-ring flex w-full items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-3 text-left"
      >
        <span className="text-ink-dim">{open ? "▾" : "▸"}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Secundarios · {total}
        </span>
      </button>
      {open && <SecondaryHabitsList groups={groups} date={date} />}
    </section>
  );
}
