"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { HabitNode } from "@/lib/plan/sub-habits";
import { updateHabitNode, reorderHabitNode, moveHabitNodeToParent, moveHabitNodeToTopLevel, addHabitChild } from "./actions";
import { archiveActivity } from "../habitos/actions";
import { HABIT_ICON_NAMES, HabitIcon } from "@/lib/icons/habit-icons";
import { BottomSheetModal } from "../compact-modal-card";

function collectIds(n: HabitNode): string[] {
  return [n.activityId, ...n.children.flatMap(collectIds)];
}

function heightOf(n: HabitNode): number {
  if (n.children.length === 0) return 1;
  return 1 + Math.max(...n.children.map(heightOf));
}

type FlatNode = { activityId: string; name: string; depth: number };

function flatten(nodes: HabitNode[], depth: number): FlatNode[] {
  return nodes.flatMap((n) => [{ activityId: n.activityId, name: n.name, depth }, ...flatten(n.children, depth + 1)]);
}

// "⋯" de cada hábito/subhábito del árbol de un bloque — editar
// nombre/hora/secundario, subir/bajar de orden, mover a otro padre o al
// primer nivel, agregar un subhábito, o desactivarlo. Mismo patrón de
// bottom sheet que PlanBlockMenu — sin drag-and-drop, solo botones.
export function HabitNodeMenu({
  date,
  blockId,
  node,
  depth,
  allNodes,
}: {
  date: string;
  blockId: string;
  node: HabitNode;
  depth: 1 | 2 | 3;
  allNodes: HabitNode[];
}) {
  const router = useRouter();
  const toast = useToast();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(node.name);
  const [hora, setHora] = useState(node.horaSugerida ?? "");
  const [isOptional, setIsOptional] = useState(node.isOptional);
  const [icon, setIcon] = useState(node.icon ?? "");
  const [targetValue, setTargetValue] = useState(node.targetValue != null ? String(node.targetValue) : "");
  const [unit, setUnit] = useState(node.unit ?? "");
  const [countSteps, setCountSteps] = useState(node.countSteps ? node.countSteps.join(", ") : "");
  const [newParentId, setNewParentId] = useState("");
  const [childName, setChildName] = useState("");
  const [childOptional, setChildOptional] = useState(false);
  const [pending, startTransition] = useTransition();

  const excluded = new Set(collectIds(node));
  const height = heightOf(node);
  const targets = flatten(allNodes, 1).filter(
    (f) => !excluded.has(f.activityId) && (height > 1 ? f.depth === 1 : f.depth <= 2),
  );

  function run(action: () => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      try {
        await action();
        after?.();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "Algo salió mal.", tone: "error" });
      }
    });
  }

  const saveEdit = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", node.activityId);
      fd.set("name", name);
      fd.set("horaSugerida", hora);
      if (isOptional) fd.set("isOptional", "on");
      fd.set("icon", icon);
      fd.set("targetValue", targetValue);
      fd.set("unit", unit);
      fd.set("countSteps", countSteps);
      return updateHabitNode(fd);
    });

  const reorder = (direction: "up" | "down") =>
    run(() => {
      const fd = new FormData();
      fd.set("id", node.activityId);
      if (depth === 1) fd.set("blockId", blockId);
      fd.set("direction", direction);
      return reorderHabitNode(fd);
    });

  const moveToParent = () => {
    if (!newParentId) return;
    run(() => {
      const fd = new FormData();
      fd.set("id", node.activityId);
      fd.set("newParentId", newParentId);
      return moveHabitNodeToParent(fd);
    });
  };

  const moveToTopLevel = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", node.activityId);
      fd.set("blockId", blockId);
      return moveHabitNodeToTopLevel(fd);
    });

  const addChild = () => {
    if (!childName.trim()) return;
    run(
      () => {
        const fd = new FormData();
        fd.set("parentId", node.activityId);
        fd.set("name", childName);
        if (childOptional) fd.set("isOptional", "on");
        return addHabitChild(fd);
      },
      () => {
        setChildName("");
        setChildOptional(false);
      },
    );
  };

  const deactivate = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", node.activityId);
      return archiveActivity(fd);
    });

  const header = (
    <div className="shrink-0">
      <div className="flex justify-center pt-[11px]">
        <span className="h-1 w-[38px] rounded-full bg-line-strong" />
      </div>
      <div className="px-[18px] pt-4">
        <button type="button" onClick={() => setOpen(false)} className="focus-ring text-[14px] text-ink-muted">
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        title="Editar hábito"
        className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-ui text-[11px] text-ink-dim hover:text-ink"
      >
        ⋯
      </button>
      <BottomSheetModal
        open={open}
        onOpenChange={setOpen}
        title={`Editar ${node.name}`}
        header={header}
        widthClassName="md:max-w-md"
        returnFocusRef={triggerRef}
      >
        <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto px-[18px] pb-2 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="focus-ring min-h-11 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[15px] text-ink"
                />
                <label className="flex items-center gap-1.5 text-[13px] text-ink-dim">
                  <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} />
                  Secundario
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Ícono</label>
                <div className="grid grid-cols-8 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIcon("")}
                    title="Sin ícono"
                    className={`flex h-9 items-center justify-center rounded-ui border text-[10px] ${
                      icon === "" ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-dim"
                    }`}
                  >
                    ✕
                  </button>
                  {HABIT_ICON_NAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setIcon(n)}
                      title={n}
                      className={`flex h-9 items-center justify-center rounded-ui border ${
                        icon === n ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-dim"
                      }`}
                    >
                      <HabitIcon icon={n} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Hábito contador (opcional)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="Meta (ej: 1000)"
                    className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[14px] text-ink placeholder:text-ink-dim"
                  />
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Unidad (ej: saltos)"
                    className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[14px] text-ink placeholder:text-ink-dim"
                  />
                </div>
                <input
                  value={countSteps}
                  onChange={(e) => setCountSteps(e.target.value)}
                  placeholder="Pasos de los botones, separados por coma (ej: 100, 200)"
                  className="focus-ring min-h-11 rounded-ui border border-line bg-canvas px-3 text-[14px] text-ink placeholder:text-ink-dim"
                />
              </div>

              <button
                type="button"
                disabled={pending || !name.trim()}
                onClick={saveEdit}
                className="flex min-h-11 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft text-[13px] font-medium text-ink disabled:opacity-50"
              >
                Guardar
              </button>

              <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Orden</div>
              <div className="grid grid-cols-2 gap-[7px]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => reorder("up")}
                  className="flex min-h-11 items-center justify-center rounded-ui border border-line text-[13px] font-medium text-ink-muted disabled:opacity-50"
                >
                  ↑ Subir
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => reorder("down")}
                  className="flex min-h-11 items-center justify-center rounded-ui border border-line text-[13px] font-medium text-ink-muted disabled:opacity-50"
                >
                  ↓ Bajar
                </button>
              </div>

              {depth > 1 && (
                <>
                  <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Mover</div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={newParentId}
                      onChange={(e) => setNewParentId(e.target.value)}
                      className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-2 text-[13px] text-ink"
                    >
                      <option value="">Elegir nuevo padre…</option>
                      {targets.map((t) => (
                        <option key={t.activityId} value={t.activityId}>
                          {"— ".repeat(t.depth - 1)}
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending || !newParentId}
                      onClick={moveToParent}
                      className="flex min-h-11 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft px-3 text-[13px] font-medium text-ink disabled:opacity-50"
                    >
                      Mover
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={moveToTopLevel}
                    className="flex min-h-11 items-center justify-center rounded-ui border border-line text-[13px] font-medium text-ink-muted disabled:opacity-50"
                  >
                    ⇤ Mover a primer nivel del bloque
                  </button>
                </>
              )}

              {depth < 3 && (
                <>
                  <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    Agregar subhábito
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="Nombre…"
                      className="focus-ring min-h-11 flex-1 rounded-ui border border-line bg-canvas px-3 text-[14px] text-ink"
                    />
                    <label className="flex items-center gap-1 text-[12px] text-ink-dim">
                      <input type="checkbox" checked={childOptional} onChange={(e) => setChildOptional(e.target.checked)} />
                      Sec.
                    </label>
                    <button
                      type="button"
                      disabled={pending || !childName.trim()}
                      onClick={addChild}
                      className="flex min-h-11 shrink-0 items-center justify-center rounded-ui border border-accent/40 bg-accent-soft px-3 text-[13px] font-medium text-ink disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={pending}
                onClick={deactivate}
                className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-ui border border-danger/40 text-[13px] font-medium text-danger disabled:opacity-50"
              >
                Desactivar hábito
              </button>
            </div>
      </BottomSheetModal>
    </>
  );
}
