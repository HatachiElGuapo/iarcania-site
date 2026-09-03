import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 10 — Segmented (control de segmentos) y Stepper (‹ Hoy ›). Ambos son
// enlaces reales: el estado activo lo decide el llamador (searchParams /
// ruta), no estado cliente. El segmento activo va sobre bg-surface-2.
export function Segmented({
  options,
  className,
}: {
  options: { label: ReactNode; href?: string; active?: boolean }[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex items-stretch overflow-hidden rounded-ui border border-line bg-canvas text-[11.5px]",
        className,
      )}
    >
      {options.map((o, i) => {
        const cls = cx(
          "px-3 py-1.5 transition-colors duration-120",
          i > 0 && "border-l border-line",
          o.active ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
        );
        return o.href ? (
          <a key={i} href={o.href} className={cls}>
            {o.label}
          </a>
        ) : (
          <span key={i} className={cls}>
            {o.label}
          </span>
        );
      })}
    </div>
  );
}

export function Stepper({
  prevHref,
  nextHref,
  label,
  current = false,
  className,
}: {
  prevHref?: string;
  nextHref?: string;
  label: ReactNode;
  current?: boolean; // pinta el label en accent-warm (p. ej. "Hoy")
  className?: string;
}) {
  const arrow = "flex items-center px-2.5 text-sm leading-none transition-colors duration-120";
  return (
    <div
      className={cx(
        "inline-flex items-stretch overflow-hidden rounded-ui border border-line bg-canvas",
        className,
      )}
    >
      {prevHref ? (
        <a href={prevHref} className={cx(arrow, "border-r border-line text-ink-muted hover:text-ink")}>
          ‹
        </a>
      ) : (
        <span className={cx(arrow, "border-r border-line text-ink-dim/40")}>‹</span>
      )}
      <span className={cx("px-3 py-1.5 text-[11.5px]", current ? "text-accent-warm" : "text-ink-muted")}>
        {label}
      </span>
      {nextHref ? (
        <a href={nextHref} className={cx(arrow, "border-l border-line text-ink-muted hover:text-ink")}>
          ›
        </a>
      ) : (
        <span className={cx(arrow, "border-l border-line text-ink-dim/40")}>›</span>
      )}
    </div>
  );
}
