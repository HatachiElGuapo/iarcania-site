// Punto único de estilo para las tarjetas de bloque de Plan (y lo que se
// le equipara, como las 3 acciones de hoy): Tu día (escritorio/móvil,
// day-event-row.tsx/mobile-day-row.tsx) y /dashboard/plan (escritorio/
// móvil, plan/page.tsx). Revertido tras el commit f27ef4c: NINGUNA
// tarjeta cambia de borde/fondo al completarse — solo el checkbox se
// marca y el título queda tachado suave, igual que antes de ese commit.
// Sin "use client": son strings puros, seguros desde Server y Client
// Components.
export function planCardWrapperClass(_done: boolean): string {
  return "border-line bg-surface";
}

export function planCardCheckboxClass(done: boolean): string {
  return done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent";
}

export function planCardTitleClass(done: boolean): string {
  return done ? "text-ink-dim line-through" : "text-ink";
}
