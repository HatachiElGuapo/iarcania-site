"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cx } from "./cx";

// 5b — Toast de confirmación. Abajo a la derecha, 4 s, una sola línea.
// «Deshacer» solo cuando existe la acción inversa; si no, se omite el enlace
// en vez de dejarlo muerto.
//
// Requiere montar <ToastProvider> una vez (en el layout del dashboard, no en
// una página). useToast() fuera del provider es un no-op silencioso.
export type ToastInput = {
  message: string;
  tone?: "success" | "error";
  // Cuánto dura en pantalla (ms) — 4000 por defecto. Un toast con `undo`
  // que de verdad vaya a deshacer algo (no solo una Server Action
  // inversa, sino una ventana real para cancelar un borrado diferido —
  // ver acciones/actions-card.tsx) suele necesitar más que los 4s de
  // siempre.
  durationMs?: number;
  undo?: {
    label?: string;
  } & (
    | { action: (formData: FormData) => void | Promise<void>; fields?: Record<string, string>; onClick?: undefined }
    // Deshacer como callback plano (ej. cancelar un borrado diferido en
    // el propio cliente, sin Server Action de por medio) en vez de una
    // Server Action inversa.
    | { onClick: () => void; action?: undefined; fields?: undefined }
  );
};

type Toast = ToastInput & { id: number };

const Ctx = createContext<{ show: (t: ToastInput) => void }>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.durationMs ?? 4000);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex items-center gap-2.5 rounded-ui border border-l-[3px] bg-surface-2 px-3 py-2.5 text-[12px] text-ink",
              t.tone === "error" ? "border-danger/26 border-l-danger" : "border-success/26 border-l-success",
            )}
          >
            <span aria-hidden className={t.tone === "error" ? "text-danger" : "text-success"}>
              {t.tone === "error" ? "⚠" : "✓"}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.undo &&
              (t.undo.onClick ? (
                <button
                  type="button"
                  onClick={() => {
                    t.undo!.onClick!();
                    setItems((x) => x.filter((i) => i.id !== t.id));
                  }}
                  className="focus-ring rounded-ui px-1 text-meta text-ink-muted hover:text-ink"
                >
                  {t.undo.label ?? "Deshacer"}
                </button>
              ) : (
                <form action={t.undo.action}>
                  {t.undo.fields &&
                    Object.entries(t.undo.fields).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                  <button type="submit" className="focus-ring rounded-ui px-1 text-meta text-ink-muted hover:text-ink">
                    {t.undo.label ?? "Deshacer"}
                  </button>
                </form>
              ))}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
