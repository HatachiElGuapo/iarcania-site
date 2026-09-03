import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 02 — Card. Header en mayúsculas + badge de conteo + enlace a la
// derecha. Sin sombra: la elevación es el borde y el cambio de superficie.
// `flush` quita el padding del cuerpo (cuando el hijo es tabla o lista).
export function Card({
  title,
  count,
  action,
  footer,
  flush = false,
  className,
  children,
}: {
  title?: string;
  count?: ReactNode;
  action?: ReactNode; // JSX ya renderizado, p. ej. <a>Ver todo →</a>
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("overflow-hidden rounded-ui-lg border border-line bg-surface", className)}>
      {title != null && (
        <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {title}
          </span>
          {count != null && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-ink-muted">
              {count}
            </span>
          )}
          {action && <span className="ml-auto text-[11px] text-ink-dim">{action}</span>}
        </div>
      )}
      <div className={flush ? "" : "p-3.5"}>{children}</div>
      {footer && (
        <div className="border-t border-line bg-surface-sunken px-3.5 py-2.5 text-[11px] text-ink-dim">
          {footer}
        </div>
      )}
    </section>
  );
}
