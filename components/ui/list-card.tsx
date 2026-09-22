import type { ReactNode } from "react";
import { cx } from "./cx";

// Móvil · fila de lista genérica (Mi día, Vicios, Cobros, Próximos…). Mismo
// look en todas: borde completo + acento de categoría/estado en el borde
// izquierdo, min-height 44px (objetivo táctil móvil — ver docs de diseño
// "App Movil"). Solo el shell visual: para filas que disparan una Server
// Action, el <form> envuelve <ListCard> y el <button type="submit"> va
// adentro con className="contents" (sin caja propia) para no romper el
// flex/padding del shell.
export function ListCard({
  accent,
  tone = "surface",
  className,
  children,
}: {
  accent?: string;
  tone?: "surface" | "surface-2";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex min-h-11 items-center gap-[11px] rounded-ui-lg border border-line px-3 py-[11px]",
        tone === "surface-2" ? "bg-surface-2" : "bg-surface",
        accent && "border-l-[3px]",
        className,
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      {children}
    </div>
  );
}
