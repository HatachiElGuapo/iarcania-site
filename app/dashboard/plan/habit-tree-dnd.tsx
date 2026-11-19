"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/components/ui/toast";
import { SafeActionButton } from "../safe-action-button";
import { toggleLogToday } from "../habitos/actions";
import { reorderHabitNode, moveHabitNodeToParent, moveHabitNodeToTopLevel } from "./actions";
import { HabitNodeMenu } from "./habit-node-menu";
import type { HabitNode } from "@/lib/plan/sub-habits";
import { HabitIcon } from "@/lib/icons/habit-icons";

// Ancho de cada nivel de sangría/línea guía, en px — también la unidad que
// usa la proyección de drag (arrastrar a la derecha ~1 unidad = anidar bajo
// el ítem anterior, sin desplazamiento horizontal = reordenar entre
// hermanos). Mismo patrón que el ejemplo oficial "sortable tree" de dnd-kit.
const INDENT = 18;
const MAX_DEPTH = 2; // 0 = primer nivel, 1 = hijo, 2 = nieto (3 niveles en total)
const ROOT_DROP_ID = "__root__";

type FlatItem = { id: string; node: HabitNode; depth: number; parentId: string | null };

function flatten(nodes: HabitNode[], depth: number, parentId: string | null): FlatItem[] {
  return nodes.flatMap((n) => [
    { id: n.activityId, node: n, depth, parentId },
    ...flatten(n.children, depth + 1, n.activityId),
  ]);
}

function heightOf(n: HabitNode): number {
  if (n.children.length === 0) return 1;
  return 1 + Math.max(...n.children.map(heightOf));
}

function collectIds(n: HabitNode): Set<string> {
  const set = new Set([n.activityId]);
  for (const c of n.children) for (const id of collectIds(c)) set.add(id);
  return set;
}

function removeNode(nodes: HabitNode[], id: string): { removed: HabitNode | null; rest: HabitNode[] } {
  const idx = nodes.findIndex((n) => n.activityId === id);
  if (idx !== -1) {
    return { removed: nodes[idx], rest: [...nodes.slice(0, idx), ...nodes.slice(idx + 1)] };
  }
  for (let i = 0; i < nodes.length; i++) {
    const { removed, rest } = removeNode(nodes[i].children, id);
    if (removed) {
      const next = [...nodes];
      next[i] = { ...nodes[i], children: rest };
      return { removed, rest: next };
    }
  }
  return { removed: null, rest: nodes };
}

function insertNode(nodes: HabitNode[], parentId: string | null, index: number, node: HabitNode): HabitNode[] {
  if (parentId === null) {
    const arr = [...nodes];
    arr.splice(Math.max(0, Math.min(index, arr.length)), 0, node);
    return arr;
  }
  return nodes.map((n) => {
    if (n.activityId === parentId) {
      const children = [...n.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
      return { ...n, children };
    }
    return { ...n, children: insertNode(n.children, parentId, index, node) };
  });
}

function getDragDepth(offsetX: number): number {
  return Math.round(offsetX / INDENT);
}

// Tras un deploy, el bundle viejo referencia Server Actions que el server
// nuevo ya no conoce — Next.js lo reporta con este mensaje. No es un error
// de negocio: recargar trae el bundle nuevo con las acciones correctas.
function isStaleServerActionError(err: unknown): boolean {
  return err instanceof Error && /Failed to find Server Action/i.test(err.message);
}

// Recuerda qué hábitos el usuario abrió/cerró a mano — por id, global (no
// por bloque/fecha): un hábito es el mismo hábito se vea donde se vea.
// Envuelto en try/catch porque localStorage puede no estar disponible
// (modo privado, cuota llena) — si falla, simplemente no se recuerda.
const COLLAPSE_STORAGE_KEY = "iarcania.plan.habitTree.collapsed";

function loadCollapsedOverrides(): Record<string, boolean> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollapsedOverrides(map: Record<string, boolean>) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // no disponible — se pierde el recuerdo entre sesiones, no rompe nada.
  }
}

// Marca/desmarca `id` y TODOS sus descendientes a `done` (igual que
// applyHabitToggle en el servidor) y recalcula cada ancestro en el camino
// de vuelta: done = (ya estaba done) || todos sus hijos quedaron done —
// misma fórmula que loadHabitTreesByBlock. Es una actualización optimista:
// la próxima revalidación (router.refresh) trae el estado real por si
// hay un caso borde (ej. un ancestro con su propio log directo que esta
// aproximación no puede distinguir de "quedó done por sus hijos").
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

// Proyección de dónde quedaría el ítem si se soltara ahora — mismo
// algoritmo que el ejemplo oficial de dnd-kit para árboles ordenables:
// el desplazamiento horizontal decide la profundidad deseada, acotada por
// la profundidad del ítem anterior (+1) y la del siguiente, en la lista
// visual ya reordenada.
function getProjection(items: FlatItem[], activeId: string, overId: string, offsetX: number) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const previousItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];
  const dragDepth = getDragDepth(offsetX);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? Math.min(previousItem.depth + 1, MAX_DEPTH) : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  let depth = projectedDepth;
  if (depth > maxDepth) depth = maxDepth;
  if (depth < minDepth) depth = minDepth;

  function getParentId(): string | null {
    if (depth === 0 || !previousItem) return null;
    if (depth === previousItem.depth) return previousItem.parentId;
    if (depth > previousItem.depth) return previousItem.id;
    const newParent = newItems
      .slice(0, overIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;
    return newParent ?? null;
  }

  return { depth, parentId: getParentId(), overIndex };
}

function HabitRow({
  item,
  date,
  blockId,
  allNodes,
  onToggled,
  collapsed,
  onToggleCollapse,
}: {
  item: FlatItem;
  date: string;
  blockId: string;
  allNodes: HabitNode[];
  onToggled: (activityId: string, done: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: (activityId: string) => void;
}) {
  const { node, depth } = item;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const toast = useToast();

  function onHabitResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    // Optimista: refleja el done/cascada ya, sin esperar a que
    // router.refresh() (dentro de SafeActionButton) traiga el árbol
    // actualizado del servidor.
    onToggled(node.activityId, r.done);
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-stretch ${isDragging ? "opacity-40" : ""}`}
    >
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="w-[18px] shrink-0 border-l border-line" />
      ))}
      <div className="flex min-w-0 flex-1 items-center gap-1 py-0.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          title="Arrastrar para mover/reordenar"
          className="focus-ring flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-[12px] text-ink-dim hover:text-ink active:cursor-grabbing"
        >
          ⠿
        </button>
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.activityId)}
            title={collapsed ? "Expandir" : "Minimizar"}
            className="focus-ring flex h-6 w-4 shrink-0 items-center justify-center text-[10px] text-ink-dim hover:text-ink"
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <SafeActionButton
          action={toggleLogToday}
          fields={{ activityId: node.activityId, date }}
          onResult={onHabitResult}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-ui py-1 text-left transition-colors duration-120 hover:bg-surface-2"
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-ui border text-[10px] ${
              node.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
            }`}
          >
            ✓
          </span>
          <HabitIcon icon={node.icon} className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          {node.horaSugerida && (
            <span className="shrink-0 text-[10px] tabular-nums text-ink-dim">{node.horaSugerida}</span>
          )}
          <span className={`min-w-0 truncate text-[12px] ${node.done ? "text-ink-dim line-through" : "text-ink"}`}>
            {node.name}
            {node.isOptional && <span className="ml-1 text-ink-dim">· secundario</span>}
          </span>
          {collapsed && node.children.length > 0 && (
            <span className="shrink-0 text-[10px] tabular-nums text-ink-dim">
              {node.children.filter((c) => c.done).length}/{node.children.length}
            </span>
          )}
        </SafeActionButton>
        <HabitNodeMenu date={date} blockId={blockId} node={node} depth={(depth + 1) as 1 | 2 | 3} allNodes={allNodes} />
      </div>
    </div>
  );
}

function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      className={`mt-1 rounded-ui border border-dashed px-2 py-1.5 text-center text-[10.5px] transition-colors ${
        isOver ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-dim"
      }`}
    >
      Soltar aquí para dejar en primer nivel del bloque
    </div>
  );
}

export function HabitTreeDnd({ date, blockId, subHabits }: { date: string; blockId: string; subHabits: HabitNode[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tree, setTree] = useState(subHabits);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [busy, setBusy] = useState(false);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});

  // El estado guardado en localStorage solo existe en el cliente — se
  // carga en un efecto (no en el useState inicial) para que el primer
  // render en servidor/cliente coincida y React no se queje de hidratación.
  useEffect(() => {
    setCollapsedOverrides(loadCollapsedOverrides());
  }, []);

  // El árbol local solo existe para el modo optimista del drag — cuando
  // llegan props nuevas (tras un router.refresh(), ej. al marcar un
  // checkbox o al terminar un drag) hay que resincronizar, si no el
  // widget se queda mostrando el estado viejo hasta un reload manual. Se
  // salta mientras `busy` (un drag propio todavía persistiendo) para no
  // pisar la actualización optimista con una revalidación de fondo que
  // podría llegar de otro cambio en curso.
  useEffect(() => {
    if (!busy) setTree(subHabits);
  }, [subHabits, busy]);

  function onToggled(activityId: string, done: boolean) {
    setTree((t) => cascadeDoneLocal(t, activityId, done));
  }

  // Por defecto: abierto si tiene hijos pendientes, cerrado si ya está
  // completo — salvo que el usuario lo haya abierto/cerrado a mano
  // (collapsedOverrides, recordado en localStorage).
  function toggleCollapse(activityId: string) {
    setCollapsedOverrides((prev) => {
      const flat = flatten(tree, 0, null);
      const node = flat.find((f) => f.id === activityId)?.node;
      const current = prev[activityId] !== undefined ? prev[activityId] : (node?.done ?? false);
      const next = { ...prev, [activityId]: !current };
      saveCollapsedOverrides(next);
      return next;
    });
  }

  function expand(activityId: string) {
    setCollapsedOverrides((prev) => {
      if (prev[activityId] === false) return prev;
      const next = { ...prev, [activityId]: false };
      saveCollapsedOverrides(next);
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const flatAll = useMemo(() => flatten(tree, 0, null), [tree]);
  // Mientras se arrastra, se excluyen los descendientes del ítem activo de
  // la lista visual — así es físicamente imposible soltarlo dentro de su
  // propia rama (ciclo) y el proyecto de profundidad solo mira vecinos
  // reales.
  const excluded = useMemo(() => {
    if (!activeId) return new Set<string>();
    const active = flatAll.find((i) => i.id === activeId);
    return active ? collectIds(active.node) : new Set<string>();
  }, [activeId, flatAll]);
  const collapsedIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of flatAll) {
      if (f.node.children.length === 0) continue;
      const override = collapsedOverrides[f.id];
      const collapsed = override !== undefined ? override : f.node.done;
      if (collapsed) set.add(f.id);
    }
    return set;
  }, [flatAll, collapsedOverrides]);

  const parentById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const f of flatAll) m.set(f.id, f.parentId);
    return m;
  }, [flatAll]);

  // Oculta descendientes de ítems minimizados (display), además de la
  // propia rama del ítem activo durante el drag (ver comentario arriba de
  // `excluded`). Esta es también la lista que participa del
  // SortableContext y de la proyección de profundidad — soltar sobre un
  // hábito minimizado lo anida igual (sus hijos ocultos no cambian la
  // posición visual del hábito en sí) y luego se expande solo.
  const visibleFlat = useMemo(() => {
    function hasCollapsedAncestor(item: FlatItem): boolean {
      let p = item.parentId;
      while (p) {
        if (collapsedIds.has(p)) return true;
        p = parentById.get(p) ?? null;
      }
      return false;
    }
    return flatAll.filter((i) => (!excluded.has(i.id) || i.id === activeId) && !hasCollapsedAncestor(i));
  }, [flatAll, excluded, activeId, collapsedIds, parentById]);

  const activeItem = activeId ? flatAll.find((i) => i.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setOffsetX(0);
  }

  function handleDragMove(e: DragMoveEvent) {
    setOffsetX(e.delta.x);
  }

  async function runReorderSteps(id: string, forBlockId: string | null, steps: number) {
    const direction = steps > 0 ? "down" : "up";
    for (let i = 0; i < Math.abs(steps); i++) {
      const fd = new FormData();
      fd.set("id", id);
      if (forBlockId) fd.set("blockId", forBlockId);
      fd.set("direction", direction);
      await reorderHabitNode(fd);
    }
  }

  async function persistMove(
    activeNode: HabitNode,
    oldParentId: string | null,
    newParentId: string | null,
    newIndexAmongNewSiblings: number,
    oldIndexAmongOldSiblings: number,
  ) {
    if (newParentId !== oldParentId) {
      const fd = new FormData();
      fd.set("id", activeNode.activityId);
      if (newParentId === null) {
        fd.set("blockId", blockId);
        await moveHabitNodeToTopLevel(fd);
      } else {
        fd.set("newParentId", newParentId);
        await moveHabitNodeToParent(fd);
      }
      return;
    }
    const steps = newIndexAmongNewSiblings - oldIndexAmongOldSiblings;
    if (steps !== 0) {
      await runReorderSteps(activeNode.activityId, oldParentId === null ? blockId : null, steps);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const dragOffsetX = offsetX;
    setActiveId(null);
    setOffsetX(0);
    if (!over) return;

    const activeFlat = flatAll.find((i) => i.id === active.id);
    if (!activeFlat) return;
    const height = heightOf(activeFlat.node);
    const oldParentId = activeFlat.parentId;

    const oldSiblingsIds = flatAll
      .filter((i) => i.parentId === oldParentId)
      .map((i) => i.id);
    const oldIndex = oldSiblingsIds.indexOf(activeFlat.id);

    let newParentId: string | null;
    let newIndexAmongNewSiblings: number;

    if (over.id === ROOT_DROP_ID) {
      newParentId = null;
      const topLevelIds = tree.map((n) => n.activityId).filter((id) => id !== activeFlat.id);
      newIndexAmongNewSiblings = topLevelIds.length;
    } else {
      if (over.id === active.id) return;
      const projection = getProjection(visibleFlat, String(active.id), String(over.id), dragOffsetX);
      let depth = projection.depth;
      let parentId = projection.parentId;
      // Respeta el máximo de 3 niveles también según la ALTURA de la rama
      // que se mueve (un padre con hijos no puede terminar en el último
      // nivel) — misma regla que moveHabitNodeToParent en el servidor.
      const maxDepthForHeight = MAX_DEPTH - (height - 1);
      if (depth > maxDepthForHeight) {
        depth = Math.max(0, maxDepthForHeight);
        parentId = depth === 0 ? null : parentId;
      }
      newParentId = parentId;
      const newSiblingsIds = flatAll
        .filter((i) => i.parentId === newParentId && i.id !== activeFlat.id)
        .map((i) => i.id);
      // Posición dentro de los nuevos hermanos según dónde terminó visualmente.
      const overIdxInNewSiblings = newSiblingsIds.indexOf(String(over.id));
      newIndexAmongNewSiblings = overIdxInNewSiblings >= 0 ? overIdxInNewSiblings : newSiblingsIds.length;
    }

    if (newParentId === oldParentId && newIndexAmongNewSiblings === oldIndex) return;

    const snapshot = tree;
    const { removed, rest } = removeNode(tree, activeFlat.id);
    if (!removed) return;
    const nextTree = insertNode(rest, newParentId, newIndexAmongNewSiblings, removed);
    setTree(nextTree);
    setBusy(true);
    // Si quedó anidado bajo un hábito que estaba minimizado, se expande
    // para que se vea de una.
    if (newParentId && newParentId !== oldParentId) expand(newParentId);

    persistMove(activeFlat.node, oldParentId, newParentId, newIndexAmongNewSiblings, oldIndex)
      .then(() => {
        router.refresh();
      })
      .catch((err) => {
        if (isStaleServerActionError(err)) {
          toast.show({ message: "Hay una versión nueva, recargando…", tone: "error" });
          window.location.reload();
          return;
        }
        setTree(snapshot);
        toast.show({ message: err instanceof Error ? err.message : "No se pudo mover el hábito.", tone: "error" });
      })
      .finally(() => setBusy(false));
  }

  if (tree.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleFlat.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex flex-col gap-0.5 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {visibleFlat.map((item) => (
            <HabitRow
              key={item.id}
              item={item}
              date={date}
              blockId={blockId}
              allNodes={tree}
              onToggled={onToggled}
              collapsed={collapsedIds.has(item.id)}
              onToggleCollapse={toggleCollapse}
            />
          ))}
        </div>
      </SortableContext>
      <RootDropZone active={!!activeId} />
      <DragOverlay>
        {activeItem ? (
          <div className="rounded-ui border border-accent/40 bg-surface px-2 py-1 text-[12px] text-ink shadow-sm">
            {activeItem.node.horaSugerida && (
              <span className="mr-1.5 tabular-nums text-ink-dim">{activeItem.node.horaSugerida}</span>
            )}
            {activeItem.node.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
