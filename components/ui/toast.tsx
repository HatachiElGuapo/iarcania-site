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
  undo?: {
    label?: string;
    action: (formData: FormData) => void | Promise<void>; // Server Action inversa
    fields?: Record<string, string>;
  };
};

type Toast = ToastInput & { id: number };

const Ctx = createContext<{ show: (t: ToastInput) => void }>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
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
            {t.undo && (
              <form action={t.undo.action}>
                {t.undo.fields &&
                  Object.entries(t.undo.fields).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <button type="submit" className="text-[11px] text-ink-muted hover:text-ink">
                  {t.undo.label ?? "Deshacer"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
