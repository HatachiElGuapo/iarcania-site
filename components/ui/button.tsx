import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

// 4b · botón del sistema nuevo. Primario = accent PLANO (reemplaza el viejo
// bg-gradient-cta/shadow-glow-purple). El peligroso nunca es sólido: borde y
// fondo al 10% (5b). Transición solo de color/opacidad, 120 ms (4a).
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90",
  secondary:
    "border border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink",
  ghost: "text-ink-muted hover:text-ink",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:border-danger/50",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-3.5 py-2 text-xs",
};

type Props = Omit<ComponentProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  href?: string;
  children?: ReactNode;
};

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cx(
    "focus-ring inline-flex items-center justify-center gap-2 rounded-ui font-medium",
    "transition-[color,background-color,border-color,opacity] duration-120",
    "disabled:pointer-events-none disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
