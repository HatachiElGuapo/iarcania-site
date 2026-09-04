import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 06 — QuickCapture. Barra pegada al borde inferior del área de
// contenido, siempre visible. Un solo campo de texto obligatorio; el resto
// (`extras`) son selects con default. Server-first: es un <form action=>
// plano, la validación real vive en la Server Action.
export function QuickCapture({
  action,
  name = "title",
  placeholder,
  hidden,
  extras,
  submitLabel = "+ Agregar",
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name?: string;
  placeholder: string;
  hidden?: Record<string, string>;
  extras?: ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={cx(
        "flex flex-wrap items-center gap-2 border-t border-line bg-surface-sunken px-3.5 py-3",
        className,
      )}
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input
        name={name}
        required
        placeholder={placeholder}
        className="focus-ring min-w-[10rem] flex-1 rounded-ui border border-line bg-canvas px-3 py-2 text-body text-ink placeholder:text-ink-dim"
      />
      {extras}
      <button
        type="submit"
        className="focus-ring shrink-0 rounded-ui bg-accent px-3.5 py-2 text-body font-medium text-white transition-colors duration-120 hover:bg-accent/90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
