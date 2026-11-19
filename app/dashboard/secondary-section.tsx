"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import { DeferButton } from "./plan/defer-button";
import type { HabitNode } from "@/lib/plan/sub-habits";
import type { SecondaryBand, SecondaryEntry } from "@/lib/plan/secondary";

const BAND_LABEL: Record<SecondaryBand, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };
const BANDS: SecondaryBand[] = ["manana", "tarde", "noche"];

// Marca/desmarca `id` y toda su descendencia, y recalcula cada ancestro
// en el camino de vuelta (done = ya estaba done || todos sus hijos
// quedaron done) — mismo criterio y misma lógica que cascadeDoneLocal en
// habit-tree-dnd.tsx; se duplica acá (es chica) para no acoplar este
// archivo, sin drag, a ese.
function cascadeDoneLocal(nodes: HabitNode[], targetId: string, done: boolean): HabitNode[] {
  function setAll(n: HabitNode): HabitNode {
    return { ...n, done, children: n.children.map(setAll) };
  }
  function walk(list: HabitNode[]): { list: HabitNode[]; found: boolean } {
    let found = false;
    const next = list.map((n) => {
      if (n.activityId === targetId) {
        found = true;
        return setAll(n);
      }
      if (n.children.length > 0) {
        const res = walk(n.children);
        if (res.found) {
          found = true;
          const allChildrenDone = res.list.every((c) => c.done);
          return { ...n, children: res.list, done: done ? n.done || allChildrenDone : allChildrenDone };
        }
      }
      return n;
    });
    return { list: next, found };
  }
  return walk(nodes).list;
}

function cascadeDoneInGroups(
  groups: Record<SecondaryBand, SecondaryEntry[]>,
  activityId: string,
  done: boolean,
): Record<SecondaryBand, SecondaryEntry[]> {
  function updateEntries(entries: SecondaryEntry[]): SecondaryEntry[] {
    return entries.map((e) => ({ ...e, node: cascadeDoneLocal([e.node], activityId, done)[0] }));
  }
  return { manana: updateEntries(groups.manana), tarde: updateEntries(groups.tarde), noche: updateEntries(groups.noche) };
}

function countTotals(groups: Record<SecondaryBand, SecondaryEntry[]>) {
  const entries = [...groups.manana, ...groups.tarde, ...groups.noche];
  return { total: entries.length, done: entries.filter((e) => e.node.done).length };
}

function SecondaryRow({
  node,
  date,
  depth,
  onToggled,
}: {
  node: HabitNode;
  date: string;
  depth: number;
  onToggled: (activityId: string, done: boolean) => void;
}) {
  // Igual que el árbol del Plan: abierto si tiene hijos pendientes,
  // cerrado si ya está completo — sin persistencia acá (no es un árbol
  // arrastrable, es un recordatorio aparte, más simple).
  const [collapsed, setCollapsed] = useState(node.children.length > 0 && node.done);
  const toast = useToast();
  const hasChildren = node.children.length > 0;

  function onResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    onToggled(node.activityId, r.done);
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
            <SecondaryRow key={c.activityId} node={c} date={date} depth={depth + 1} onToggled={onToggled} />
          ))}
        </div>
      )}
    </div>
  );
}

function SecondaryGroupEntry({
  entry,
  date,
  onToggled,
}: {
  entry: SecondaryEntry;
  date: string;
  onToggled: (activityId: string, done: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-ui border border-line bg-surface px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[10px] text-ink-dim">
          <span className="tabular-nums">{entry.dueTime}</span>
          <span className="truncate">· {entry.blockText}</span>
        </div>
        <DeferButton date={date} blockId={entry.blockId} text={entry.blockText} startTime={entry.blockStartTime} />
      </div>
      <SecondaryRow node={entry.node} date={date} depth={0} onToggled={onToggled} />
    </div>
  );
}

function SecondaryModalContent({
  groups,
  date,
  onToggled,
}: {
  groups: Record<SecondaryBand, SecondaryEntry[]>;
  date: string;
  onToggled: (activityId: string, done: boolean) => void;
}) {
  const { total } = countTotals(groups);
  if (total === 0) {
    return <p className="px-3.5 py-3 text-xs text-ink-muted">Sin secundarios pendientes hoy.</p>;
  }
  return (
    <div className="flex flex-col gap-3 p-3.5">
      {BANDS.map((band) =>
        groups[band].length === 0 ? null : (
          <div key={band} className="flex flex-col gap-1.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {BAND_LABEL[band]}
            </div>
            <div className="flex flex-col gap-1.5">
              {groups[band].map((entry) => (
                <SecondaryGroupEntry key={entry.node.activityId} entry={entry} date={date} onToggled={onToggled} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// Tarjeta compacta "Secundarios" — en reposo solo "Secundarios · X/Y hoy"
// y cuántos están pendientes (hora ya pasada, sin marcar). Al tocarla
// abre un modal (centrado y ancho en escritorio, hoja a pantalla
// completa en móvil — una sola marca responsive, no dos componentes
// distintos) con el árbol completo. `pendingActivityIds` es la misma
// lista que ya usa el panel de Pendientes (getPendingSecondaryHabits) —
// acá solo sirve para decidir el contador "N pendientes" y para poder
// restarle en vivo cuando se marca algo, sin tener que recalcular horas
// ni el corte de "Dormir" en el cliente.
export function SecondaryCard({
  groups: initialGroups,
  pendingActivityIds,
  date,
}: {
  groups: Record<SecondaryBand, SecondaryEntry[]>;
  pendingActivityIds: string[];
  date: string;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [open, setOpen] = useState(false);
  const [clearedPendingIds, setClearedPendingIds] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // El modal solo existe mientras `open` — cuando llegan props nuevas
  // (tras router.refresh(), ej. al marcar algo) hay que resincronizar el
  // árbol local, igual que HabitTreeDnd.
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? triggerRef.current;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  function onToggled(activityId: string, done: boolean) {
    setGroups((g) => cascadeDoneInGroups(g, activityId, done));
    setClearedPendingIds((prev) => {
      const next = new Set(prev);
      if (done && pendingActivityIds.includes(activityId)) next.add(activityId);
      else if (!done) next.delete(activityId);
      return next;
    });
  }

  const { total, done } = countTotals(groups);
  const pendingCount = pendingActivityIds.filter((id) => !clearedPendingIds.has(id)).length;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring flex w-full items-center justify-between gap-2.5 rounded-ui-lg border border-line bg-surface px-3.5 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-ink-dim">▸</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Secundarios</span>
        </span>
        <span className="flex items-center gap-3 text-meta text-ink-dim">
          {pendingCount > 0 && (
            <span className="text-danger/80">
              {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="tabular-nums">
            {done}/{total} hoy
          </span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Secundarios"
            tabIndex={-1}
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[14px] border-t border-line-strong bg-surface-2 outline-none md:max-h-[85vh] md:max-w-2xl md:rounded-ui-lg md:border"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-3.5 py-3">
              <span className="font-display text-[15px] font-semibold text-ink">Secundarios</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-ui px-2 py-1 text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SecondaryModalContent groups={groups} date={date} onToggled={onToggled} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
