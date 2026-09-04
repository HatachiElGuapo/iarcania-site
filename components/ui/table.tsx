import type { ReactNode } from "react";
import { cx } from "./cx";
import { catInfo } from "./category";

// 4b · 03 — Table. Fila de 33–38px, borde izquierdo de 2px con el color de
// categoría, acciones SIEMPRE visibles (no en hover: no hay hover fiable en
// uso diario rápido). Sin drag-and-drop.
//
// API deliberadamente explícita: el mismo string `cols` (grid-template-
// columns) se pasa al head y a cada row. RSC no permite context entre
// server components, así que no se comparte por provider.

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-hidden rounded-ui-lg border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function TableHead({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div
      className="grid gap-2.5 border-b border-line bg-surface-2 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function TableRow({
  cols,
  category,
  accentColor,
  href,
  children,
}: {
  cols: string;
  category?: string | null;
  /** Color del borde izquierdo si se necesita otro que el de la categoría
   *  (p. ej. rojo para filas vencidas). Gana sobre `category`. */
  accentColor?: string;
  href?: string;
  children: ReactNode;
}) {
  const accent = accentColor ?? (category ? catInfo(category).color : "transparent");
  const cls =
    "grid items-center gap-2.5 border-b border-white/[0.04] px-3.5 py-2.5 text-[12.5px] text-ink last:border-b-0";
  const style = { gridTemplateColumns: cols, borderLeft: `2px solid ${accent}` };
  return href ? (
    <a href={href} className={cx(cls, "transition-colors duration-120 hover:bg-surface-2")} style={style}>
      {children}
    </a>
  ) : (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
