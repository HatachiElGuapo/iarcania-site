"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 4b · 06b — QuickAddPanel. Igual que <QuickCapture> pero como panel
// flotante en vez de barra pegada al fondo de la card — para no tener que
// bajar a buscar el formulario cuando la lista de arriba es larga. Mismo
// patrón client-side que <ConfirmDialog>: estado local, Esc/backdrop/✕
// cierran, y el submit cierra de una (optimista, antes de la respuesta del
// Server Action).
export function QuickAddPanel({
  trigger,
  title,
  action,
  name = "title",
  placeholder,
  hidden,
  extras,
  submitLabel = "Agregar",
}: {
  trigger: ReactNode;
  title: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  name?: string;
  placeholder: string;
  hidden?: Record<string, string>;
  extras?: ReactNode;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
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
            role="dialog"
            aria-modal="true"
            className="mt-[10vh] w-full max-w-sm overflow-hidden rounded-ui-lg border border-line-strong bg-surface-2"
          >
            <div className="flex items-center border-b border-line bg-surface px-3.5 py-3">
              <span className="text-[13px] font-medium text-ink">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="focus-ring ml-auto rounded-ui px-1 text-[13px] text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>
            <form
              action={action}
              onSubmit={() => setOpen(false)}
              className="flex flex-col gap-2.5 p-3.5"
            >
              {hidden &&
                Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <input
                ref={inputRef}
                name={name}
                required
                placeholder={placeholder}
                className="focus-ring rounded-ui border border-line bg-canvas px-3 py-2 text-body text-ink placeholder:text-ink-dim"
              />
              {extras}
              <button
                type="submit"
                className="focus-ring self-start rounded-ui bg-accent px-3.5 py-2 text-body font-medium text-white transition-colors duration-120 hover:bg-accent/90"
              >
                {submitLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
