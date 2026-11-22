"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "./safe-action-button";
import { toggleLogToday } from "./habitos/actions";
import { DeferButton } from "./plan/defer-button";
import { CompactModalCard } from "./compact-modal-card";
import { CounterControls } from "./plan/counter-controls";
import type { HabitNode } from "@/lib/plan/sub-habits";
import { HabitIcon } from "@/lib/icons/habit-icons";
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

export function cascadeDoneInGroups(
  groups: Record<SecondaryBand, SecondaryEntry[]>,
  activityId: string,
  done: boolean,
): Record<SecondaryBand, SecondaryEntry[]> {
  function updateEntries(entries: SecondaryEntry[]): SecondaryEntry[] {
    return entries.map((e) => ({ ...e, node: cascadeDoneLocal([e.node], activityId, done)[0] }));
  }
  return { manana: updateEntries(groups.manana), tarde: updateEntries(groups.tarde), noche: updateEntries(groups.noche) };
}

// Actualiza currentValue de `activityId` dentro del árbol (mismo patrón
// que updateNodeValue en habit-tree-dnd.tsx) — se usa junto con
// cascadeDoneInGroups cuando CounterControls cruza la meta: primero el
// valor, después el done.
function updateValueLocal(nodes: HabitNode[], targetId: string, value: number): HabitNode[] {
  return nodes.map((n) =>
    n.activityId === targetId
      ? { ...n, currentValue: value }
      : { ...n, children: updateValueLocal(n.children, targetId, value) },
  );
}

export function updateValueInGroups(
  groups: Record<SecondaryBand, SecondaryEntry[]>,
  activityId: string,
  value: number,
): Record<SecondaryBand, SecondaryEntry[]> {
  function updateEntries(entries: SecondaryEntry[]): SecondaryEntry[] {
    return entries.map((e) => ({ ...e, node: updateValueLocal([e.node], activityId, value)[0] }));
  }
  return { manana: updateEntries(groups.manana), tarde: updateEntries(groups.tarde), noche: updateEntries(groups.noche) };
}

export function countTotals(groups: Record<SecondaryBand, SecondaryEntry[]>) {
  const entries = [...groups.manana, ...groups.tarde, ...groups.noche];
  return { total: entries.length, done: entries.filter((e) => e.node.done).length };
}

function SecondaryRow({
  node,
  date,
  depth,
  onToggled,
  onCounterChanged,
}: {
  node: HabitNode;
  date: string;
  depth: number;
  onToggled: (activityId: string, done: boolean) => void;
  onCounterChanged: (activityId: string, value: number, done: boolean) => void;
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

  function onCounterResult(activityId: string, value: number, done: boolean, toastMessage: string | null) {
    onCounterChanged(activityId, value, done);
    if (toastMessage) toast.show({ message: toastMessage, tone: "success" });
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
        {node.targetValue != null ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <SafeActionButton
                action={toggleLogToday}
                fields={{ activityId: node.activityId, date }}
                onResult={onResult}
                className={`focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
                  node.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
                }`}
              >
                ✓
              </SafeActionButton>
              <HabitIcon icon={node.icon} className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
              <span className={`min-w-0 flex-1 truncate text-[12px] ${node.done ? "text-ink-dim line-through" : "text-ink"}`}>
                {node.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
                {node.currentValue}/{node.targetValue}
                {node.unit ? ` ${node.unit}` : ""}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, (node.currentValue / node.targetValue) * 100)}%` }}
              />
            </div>
            <CounterControls activityId={node.activityId} countSteps={node.countSteps} date={date} onChanged={onCounterResult} />
          </div>
        ) : (
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
            <HabitIcon icon={node.icon} className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
            <span className={`min-w-0 truncate text-[12px] ${node.done ? "text-ink-dim line-through" : "text-ink"}`}>
              {node.name}
            </span>
          </SafeActionButton>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div className="flex flex-col gap-0.5">
          {node.children.map((c) => (
            <SecondaryRow
              key={c.activityId}
              node={c}
              date={date}
              depth={depth + 1}
              onToggled={onToggled}
              onCounterChanged={onCounterChanged}
            />
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
  onCounterChanged,
}: {
  entry: SecondaryEntry;
  date: string;
  onToggled: (activityId: string, done: boolean) => void;
  onCounterChanged: (activityId: string, value: number, done: boolean) => void;
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
      <SecondaryRow node={entry.node} date={date} depth={0} onToggled={onToggled} onCounterChanged={onCounterChanged} />
    </div>
  );
}

// Exportado también para el bloque de Plan kind="secundarios" (día-event-
// row.tsx/mobile-day-row.tsx) — misma lista agrupada por franja, sin el
// envoltorio de CompactModalCard.
export function SecondaryModalContent({
  groups,
  date,
  onToggled,
  onCounterChanged,
}: {
  groups: Record<SecondaryBand, SecondaryEntry[]>;
  date: string;
  onToggled: (activityId: string, done: boolean) => void;
  onCounterChanged: (activityId: string, value: number, done: boolean) => void;
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
                <SecondaryGroupEntry
                  key={entry.node.activityId}
                  entry={entry}
                  date={date}
                  onToggled={onToggled}
                  onCounterChanged={onCounterChanged}
                />
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
  const [clearedPendingIds, setClearedPendingIds] = useState<Set<string>>(new Set());

  // Cuando llegan props nuevas (tras router.refresh(), ej. al marcar
  // algo) hay que resincronizar el árbol local, igual que HabitTreeDnd.
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  function onToggled(activityId: string, done: boolean) {
    setGroups((g) => cascadeDoneInGroups(g, activityId, done));
    setClearedPendingIds((prev) => {
      const next = new Set(prev);
      if (done && pendingActivityIds.includes(activityId)) next.add(activityId);
      else if (!done) next.delete(activityId);
      return next;
    });
  }

  function onCounterChanged(activityId: string, value: number, done: boolean) {
    setGroups((g) => cascadeDoneInGroups(updateValueInGroups(g, activityId, value), activityId, done));
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
    <CompactModalCard
      label="Secundarios"
      title="Secundarios"
      summary={
        <>
          {pendingCount > 0 && (
            <span className="text-danger/80">
              {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="tabular-nums">
            {done}/{total} hoy
          </span>
        </>
      }
    >
      <SecondaryModalContent groups={groups} date={date} onToggled={onToggled} onCounterChanged={onCounterChanged} />
    </CompactModalCard>
  );
}
