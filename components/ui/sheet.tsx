"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./cx";

// Móvil · Sheet. Mismo patrón client-side que <QuickAddPanel> (estado
// local, Esc/backdrop cierran, el submit cierra de una, optimista) pero con
// el chrome de bottom sheet del diseño: agarradera, Cancelar/título/Guardar
// arriba del form. `open` es la señal EXTERNA para abrir (p. ej. un query
// param leído en el Server Component padre) — además del `trigger` propio,
// que abre localmente sin tocar la URL. Cerrar limpia esa señal con
// `router.replace(closeHref)` para que la URL y el estado no queden
// desincronizados.
export function Sheet({
  trigger,
  open: openSignal,
  closeHref,
  title,
  action,
  hidden,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  children,
}: {
  trigger?: ReactNode;
  open?: boolean;
  closeHref?: string;
  title: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  submitLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!openSignal);
  const [visible, setVisible] = useState(false);
  const firstFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
    if (closeHref) router.replace(closeHref);
  }

  return (
    <>
      {trigger && (
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger}
        </span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={firstFieldRef}
            role="dialog"
            aria-modal="true"
            className={cx(
              "w-full max-w-md rounded-t-[14px] border-t border-line-strong bg-surface-2",
              "pb-[max(18px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
              visible ? "translate-y-0" : "translate-y-full",
            )}
          >
            <div className="flex justify-center pt-[11px]">
              <span className="h-1 w-[38px] rounded-full bg-line-strong" />
            </div>
            <form
              action={action}
              onSubmit={() => {
                // Solo cierra la UI, optimista — NO navega acá. Un
                // router.replace/push disparado en el mismo tick que el
                // submit compite con el fetch de la Server Action (ambos
                // pasan por el router de App Router) y puede cancelarlo,
                // perdiendo el guardado. `closeHref` (limpiar ?compose=1)
                // solo aplica en `close()`, donde no hay ningún envío en
                // curso.
                setVisible(false);
                setOpen(false);
              }}
              className="flex flex-col gap-4 px-[18px] pt-4"
            >
              {hidden &&
                Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={close} className="focus-ring text-[14px] text-ink-muted">
                  {cancelLabel}
                </button>
                <span className="min-w-0 truncate font-display text-[17px] font-bold text-ink">{title}</span>
                <button type="submit" className="focus-ring text-[14px] font-semibold text-accent">
                  {submitLabel}
                </button>
              </div>
              {children}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
