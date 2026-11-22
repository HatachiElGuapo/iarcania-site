"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { BottomSheetModal } from "../compact-modal-card";
import { deleteTask } from "../actividades/actions";
import { unlinkFocusSlot, linkTaskToFocusSlot, moveFocusSlotToTomorrow } from "./actions";
import type { FocusSlot } from "@/lib/trabajo/daily-actions";

// Ventana para deshacer "Quitar"/"Borrar" — la acción de verdad (borrar la
// fila de daily_focus, o la task entera) se DIFIERE hasta que pasa este
// tiempo sin que se toque "Deshacer": mientras tanto no se tocó la base,
// así que deshacer es trivial (mismo id de task, misma posición) — no hay
// que reconstruir nada.
const UNDO_MS = 6000;

function deleteTaskFormData(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

// Menú "⋯" de una de las 3 acciones de un día — mismo menú en TodayFocusRow
// (Tu día) y FocusSlotRow (modal de Acciones), ver sus respectivos onEdit/
// onChangeSchedule (qué significa "editar" en cada fila, ya la decide
// quien llama). "Quitar de mis acciones" y "Borrar tarea" son diferidos
// (ver UNDO_MS) con un toast "Deshacer"; "Mover a mañana" es inmediato
// (no es destructivo — sigue existiendo, solo cambia de día) y "Borrar
// tarea" pide confirmación antes de empezar la cuenta regresiva.
export function FocusSlotMenu({
  slot,
  date,
  onEdit,
  onChangeSchedule,
  onOptimisticRemove,
  onRestore,
}: {
  slot: FocusSlot;
  date: string;
  onEdit: () => void;
  onChangeSchedule: () => void;
  onOptimisticRemove: () => void;
  onRestore: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!slot.taskId) return null;
  const taskId = slot.taskId;
  const title = slot.title;

  function scheduleDiffered(run: () => Promise<void>, message: string) {
    setOpen(false);
    onOptimisticRemove();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await run();
        router.refresh();
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo completar.", tone: "error" });
        onRestore();
      }
    }, UNDO_MS);

    toast.show({
      message,
      durationMs: UNDO_MS,
      undo: {
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          onRestore();
        },
      },
    });
  }

  function handleRemove() {
    scheduleDiffered(
      () => unlinkFocusSlot({ date, rank: slot.rank, taskId }),
      `Quitaste "${title}" de tus acciones.`,
    );
  }

  function handleConfirmDelete() {
    setConfirmOpen(false);
    scheduleDiffered(() => deleteTask(deleteTaskFormData(taskId)), `Borraste "${title}".`);
  }

  async function handleMoveTomorrow() {
    setOpen(false);
    try {
      await moveFocusSlotToTomorrow({ date, rank: slot.rank, taskId });
      onOptimisticRemove();
      router.refresh();
      toast.show({ message: `"${title}" se movió a mañana.`, tone: "success" });
    } catch (err) {
      toast.show({ message: err instanceof Error ? err.message : "No se pudo mover.", tone: "error" });
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        title="Más acciones"
        className="shrink-0 px-1 text-meta text-ink-dim hover:text-ink"
      >
        ⋯
      </button>
      <BottomSheetModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        widthClassName="md:max-w-sm"
        returnFocusRef={triggerRef}
      >
        <div className="flex flex-col gap-1 p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="focus-ring flex min-h-11 items-center rounded-ui px-3 text-left text-[14px] text-ink hover:bg-surface"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChangeSchedule();
            }}
            className="focus-ring flex min-h-11 items-center rounded-ui px-3 text-left text-[14px] text-ink hover:bg-surface"
          >
            Cambiar horario
          </button>
          <button
            type="button"
            onClick={handleMoveTomorrow}
            className="focus-ring flex min-h-11 items-center rounded-ui px-3 text-left text-[14px] text-ink hover:bg-surface"
          >
            Mover a mañana
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="focus-ring flex min-h-11 items-center rounded-ui px-3 text-left text-[14px] text-ink hover:bg-surface"
          >
            Quitar de mis acciones
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="focus-ring flex min-h-11 items-center rounded-ui px-3 text-left text-[14px] text-danger hover:bg-danger/10"
          >
            Borrar tarea
          </button>
        </div>
      </BottomSheetModal>

      <BottomSheetModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Borrar tarea"
        widthClassName="md:max-w-sm"
      >
        <div className="flex flex-col gap-3 p-3.5">
          <p className="text-[13px] text-ink">
            ¿Borrar «{title}»? No se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="focus-ring rounded-ui border border-line px-3 py-1.5 text-meta text-ink-muted"
            >
              Conservar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="focus-ring rounded-ui border border-danger/30 bg-danger/10 px-3 py-1.5 text-meta font-medium text-danger transition-colors duration-120 hover:border-danger/50"
            >
              Borrar
            </button>
          </div>
        </div>
      </BottomSheetModal>
    </>
  );
}
