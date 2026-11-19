"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useModalStackEntry } from "./modal-stack";

// Pieza de abajo (el diálogo en sí) de CompactModalCard, separada para
// poder reusarla con un trigger propio distinto del botón-tarjeta
// estándar (ej. MobileSubHabits, HabitNodeMenu, PlanBlockMenu — botones
// chicos dentro de una fila u otro modal, no una tarjeta completa).
//
// Soporta anidamiento: se renderiza en un portal a document.body (así un
// modal abierto DESDE otro nunca queda atrapado dentro del DOM del de
// abajo, que es lo que rompía el foco/clic-afuera/z-index antes) y se
// registra en la pila global de modales (modal-stack.ts) — solo el de
// más arriba escucha Esc/clic afuera y atrapa el foco; el z-index crece
// con la profundidad. Al cerrar un modal anidado, el foco vuelve al que
// quedó abajo (su propio trigger, no el documento) porque cada nivel
// recuerda por separado quién tenía el foco cuando se abrió.
//
// Mismo bottom sheet de siempre: centrado y ancho con scroll interno en
// escritorio, hoja a pantalla completa en móvil (clases md:, no dos
// componentes). `header` reemplaza la barra título+✕ por defecto, para
// los que ya tenían su propio encabezado (ej. el handle+"Cancelar" de
// HabitNodeMenu/PlanBlockMenu) sin perder nada de su diseño.
export function BottomSheetModal({
  open,
  onOpenChange,
  title,
  header,
  widthClassName = "md:max-w-2xl",
  children,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  header?: ReactNode;
  widthClassName?: string;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isTop, depth } = useModalStackEntry(open);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !isTop) return;
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? returnFocusRef?.current ?? null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
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
    // Solo mientras es el de más arriba — si se abre uno encima, este
    // efecto se desmonta (isTop pasa a false) y deja de competir por
    // teclado/foco con el nuevo, sin perder su propio estado.
  }, [open, isTop, onOpenChange, returnFocusRef]);

  if (!open || !mounted) return null;

  // z-50 + 10 por nivel: el primero queda igual que antes (z-50), cada
  // uno anidado encima queda estrictamente por encima del anterior.
  const zIndex = 50 + depth * 10;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/70 md:items-center md:p-4"
      style={{ zIndex }}
      onMouseDown={(e) => {
        // Si no es el de más arriba, un clic "afuera" acá en realidad cayó
        // en el backdrop de un modal más viejo que quedó tapado por uno
        // nuevo — no debe cerrar nada: el de arriba es el único dueño del
        // clic-afuera mientras esté abierto.
        if (!isTop) return;
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[14px] border-t border-line-strong bg-surface-2 outline-none md:max-h-[85vh] md:rounded-ui-lg md:border ${widthClassName}`}
      >
        {header ?? (
          <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-3.5 py-3">
            <span className="font-display text-[15px] font-semibold text-ink">{title}</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="focus-ring rounded-ui px-2 py-1 text-ink-dim hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// Shell compartido por las tarjetas compactas del dashboard que abren un
// modal completo (HabitsCard, SecondaryCard): en reposo es un botón
// angosto con `label` + `summary` a la derecha; al tocarlo abre el mismo
// BottomSheetModal de arriba.
//
// El contenido (`children`) y cualquier estado optimista propio los
// maneja quien llama — este componente no sabe nada de hábitos ni de
// cascadas, solo del shell del modal.
export function CompactModalCard({
  label,
  summary,
  title,
  children,
  open: openProp,
  onOpenChange,
}: {
  label: string;
  summary: ReactNode;
  title: string;
  children: ReactNode;
  // Controlado (ej. ActionsCard, que comparte el modal con un botón del
  // encabezado vía contexto) si se pasan ambos; si no, el componente
  // maneja su propio estado (HabitsCard, SecondaryCard).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);

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
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</span>
        </span>
        <span className="flex items-center gap-3 text-meta text-ink-dim">{summary}</span>
      </button>
      <BottomSheetModal open={open} onOpenChange={setOpen} title={title} returnFocusRef={triggerRef}>
        {children}
      </BottomSheetModal>
    </>
  );
}
