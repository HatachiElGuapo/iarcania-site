import type { ReactNode } from "react";
import { cx } from "./cx";

// Bloque de sección dentro de una página: label en mayúsculas + slot de
// acción a la derecha + contenido. Reemplaza el <h2> suelto repetido en
// todas las páginas y fija el ritmo vertical: la raíz de la página usa
// `flex flex-col gap-8` (32px entre secciones); aquí adentro, gap-4 (16px).
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{title}</h2>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
