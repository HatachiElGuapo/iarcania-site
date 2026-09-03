"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

// 5b — Confirmación destructiva. El botón peligroso NUNCA es sólido: borde y
// fondo al 10%. La acción segura ("Conservar") queda a la derecha y recibe
// el foco inicial. Esc = conservar.
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel = "Eliminar",
  action,
  hidden,
  className,
}: {
  trigger: ReactNode; // JSX del disparador
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  action: (formData: FormData) => void | Promise<void>; // Server Action
  hidden?: Record<string, string>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className={cx(
              "mt-[10vh] w-full max-w-sm overflow-hidden rounded-ui-lg border border-line-strong bg-surface-2",
              className,
            )}
          >
            <div className="px-3.5 py-3">
              <div className="text-[13px] font-medium text-ink">{title}</div>
              {body && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-muted">{body}</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-surface px-3.5 py-3">
              <form action={action}>
                {hidden &&
                  Object.entries(hidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <button
                  type="submit"
                  className="focus-ring rounded-ui border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors duration-120 hover:border-danger/50"
                >
                  {confirmLabel}
                </button>
              </form>
              <button
                ref={keepRef}
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-ui border border-line px-3 py-1.5 text-xs text-ink-muted"
              >
                Conservar
              </button>
              <span className="ml-auto text-[10.5px] text-ink-dim">Esc = conservar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
