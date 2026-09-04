import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

// Etiqueta + control apilados (el reemplazo del <Field> viejo para
// formularios planos `<form action={serverAction}>`). El ancho del control
// lo decide quien llama, con `className`.
export function Labeled({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">{label}</span>
      {children}
    </label>
  );
}

// Controles de formulario del sistema nuevo. Fondo = canvas (no un gris más
// claro), borde plano, radio 6px, foco = anillo accent/22 (sin outline azul).
// Server-safe: son solo elementos con estilo, sin hooks. Sin `w-full` en la
// base (para que sirvan inline en QuickCapture); <FormField> lo añade cuando
// el control va apilado.
const base =
  "focus-ring rounded-ui border border-line bg-canvas px-3 py-2 text-xs text-ink " +
  "placeholder:text-ink-dim transition-colors duration-120 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(base, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(base, "min-h-[80px] resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(base, "text-ink-muted", className)} {...props} />;
}
