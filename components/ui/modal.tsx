"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./cx";

// 4b · 07 — Modal. Pensado para un route-intercepting modal (@modal/(.)…):
// la ruta interceptora monta <Modal> con el mismo <Form> adentro, sin
// variantes. Cerrar = Esc, clic en el backdrop, o la ✕ → router.back()
// (o `onCloseHref` si se prefiere una ruta explícita).
export function Modal({
  title,
  children,
  footer,
  onCloseHref,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onCloseHref?: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (onCloseHref) router.push(onCloseHref);
    else router.back();
  }, [onCloseHref, router]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="mt-[8vh] w-full max-w-md overflow-hidden rounded-ui-lg border border-line-strong bg-surface-2 outline-none"
      >
        <div className="flex items-center border-b border-line bg-surface px-3.5 py-3">
          <span className="text-[13px] font-medium text-ink">{title}</span>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="focus-ring ml-auto rounded-ui px-1 text-[13px] text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="p-3.5">{children}</div>
        {footer && (
          <div className="flex items-center gap-2 border-t border-line px-3.5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
