// Contrato que devuelven las Server Actions al <Form> del sistema nuevo.
// Vive en un módulo sin "use client" para que las acciones ("use server")
// puedan importarlo sin cruzar la frontera RSC.
export type FormResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string> };

export const formOk = (): FormResult => ({ ok: true });

export const formErrors = (
  fieldErrors: Record<string, string>,
  formError?: string,
): FormResult => ({ ok: false, fieldErrors, formError });
