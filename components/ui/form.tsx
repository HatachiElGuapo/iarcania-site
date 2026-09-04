"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import type { FormResult } from "./form-result";

export type { FormResult } from "./form-result";
export { formOk, formErrors } from "./form-result";

// 4b · 05 + 5b — Form con los cuatro momentos (vacío, enviando, error de
// campo, exitoso). React 18.3 no tiene useActionState/useFormStatus, así que
// el estado va A MANO con useState + useTransition, igual que ToggleRow.
// RSC: las piezas reciben solo datos serializables; los errores viajan por
// context DENTRO del árbol cliente (la página server compone <Form> con
// <FormField>, ambos client).

type Ctx = { pending: boolean; fieldErrors: Record<string, string>; formError?: string };
const FormCtx = createContext<Ctx>({ pending: false, fieldErrors: {} });
export const useFormCtx = () => useContext(FormCtx);

export function Form({
  action,
  children,
  resetOnSuccess = true,
  className,
}: {
  action: (formData: FormData) => Promise<FormResult | void>;
  children: ReactNode;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setFieldErrors({});
    setFormError(undefined);
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await action(fd);
        if (res && res.ok === false) {
          setFieldErrors(res.fieldErrors ?? {});
          setFormError(res.formError);
          const first = res.fieldErrors && Object.keys(res.fieldErrors)[0];
          if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
          return;
        }
        if (resetOnSuccess) {
          form.reset();
          form.querySelector<HTMLElement>("input, select, textarea")?.focus();
        }
      } catch {
        setFormError("No se pudo guardar. Revisa tu conexión y vuelve a intentar.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <FormCtx.Provider value={{ pending: busy || isPending, fieldErrors, formError }}>
      <form onSubmit={handleSubmit} className={cx("flex flex-col gap-2.5", className)} noValidate>
        {children}
      </form>
    </FormCtx.Provider>
  );
}

// Banner de formulario (5b): solo para fallos que NO son de un campo (red,
// permisos, conflicto). Va arriba del primer campo y acompaña a los errores
// de campo, no los reemplaza.
export function FormBanner() {
  const { formError } = useFormCtx();
  if (!formError) return null;
  return (
    <div className="flex items-start gap-2 rounded-ui border border-danger/28 bg-danger/[0.08] px-3 py-2 text-meta leading-snug text-danger">
      <span aria-hidden>⚠</span>
      <span>{formError}</span>
    </div>
  );
}

// Un control de formulario por FormField. El valor escrito NUNCA se borra en
// error (lo mantiene el propio input no controlado). El mensaje va debajo,
// en una línea.
export function FormField({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  children: ReactElement;
}) {
  const { fieldErrors } = useFormCtx();
  const error = fieldErrors[name];
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
        {label}
      </label>
      {cloneElement(children, {
        name: children.props.name ?? name,
        "aria-invalid": error ? true : undefined,
        className: cx(
          "w-full",
          children.props.className,
          error && "border-danger/55 ring-2 ring-danger/[0.14]",
        ),
      })}
      {error ? (
        <span className="text-meta text-danger">{error}</span>
      ) : hint ? (
        <span className="text-meta text-ink-dim">{hint}</span>
      ) : null}
    </div>
  );
}

// El ancho del botón se reserva para el texto más largo (min-w): nada se
// mueve de sitio al pasar a "Guardando…".
export function FormActions({
  submitLabel = "Guardar",
  pendingLabel = "Guardando…",
  cancelHref,
  cancelLabel = "Cancelar",
}: {
  submitLabel?: string;
  pendingLabel?: string;
  cancelHref?: string;
  cancelLabel?: string;
}) {
  const { pending } = useFormCtx();
  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="focus-ring inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-ui bg-accent px-3.5 py-2 text-body font-medium text-white transition-[background-color,opacity] duration-120 hover:bg-accent/90 disabled:opacity-70"
      >
        {pending && (
          <span
            aria-hidden
            className="h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
        )}
        {pending ? pendingLabel : submitLabel}
      </button>
      {cancelHref ? (
        <a
          href={cancelHref}
          className="focus-ring rounded-ui border border-line px-3 py-2 text-body text-ink-muted"
        >
          {cancelLabel}
        </a>
      ) : (
        <button
          type="reset"
          className="focus-ring rounded-ui border border-line px-3 py-2 text-body text-ink-muted"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
