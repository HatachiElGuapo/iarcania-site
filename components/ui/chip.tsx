import type { ReactNode } from "react";
import { cx } from "./cx";
import { catInfo } from "./category";

// 4b · 08–09 — Chip (neutro) · Badge (estado, micro mayúsculas) · piezas de
// categoría. El color de categoría informa, no jerarquiza (5a): si compite
// con el violeta de acción, gana el violeta.

type Tone = "neutral" | "accent" | "warm" | "success" | "danger";

// Todos los tonos: relleno al 12%, borde al 28% (5a). El texto va a color
// pleno — sobre `surface` el 12% se lee como tinte y el borde lo cierra.
const TONE: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-ink-muted",
  accent: "border-accent/28 bg-accent/12 text-accent-text",
  warm: "border-accent-warm/28 bg-accent-warm/12 text-accent-warm",
  success: "border-success/28 bg-success/12 text-success",
  danger: "border-danger/28 bg-danger/12 text-danger",
};

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = "warm",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Punto de 6px para tabla y celda densa (5a · segundo uso permitido).
export function CategoryDot({ category, className }: { category?: string | null; className?: string }) {
  return (
    <span
      className={cx("inline-block h-1.5 w-1.5 shrink-0 rounded-[2px]", className)}
      style={{ background: catInfo(category).color }}
    />
  );
}

// Chip de categoría a 12% de fondo / 28% de borde (5a · tercer uso permitido).
export function CategoryTag({ category, className }: { category?: string | null; className?: string }) {
  const c = catInfo(category);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
        className,
      )}
      style={{ background: `${c.color}1f`, border: `1px solid ${c.color}47`, color: c.color }}
    >
      {c.label}
    </span>
  );
}
