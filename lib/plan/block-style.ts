// Estilo único de "bloque del Plan completado" (border-success/bg-success
// suave + título tachado) — compartido por TODAS las tarjetas que
// muestran un bloque de Plan o algo que se le equipara (las 3 acciones de
// hoy): Tu día (escritorio/móvil, day-event-row.tsx/mobile-day-row.tsx) y
// /dashboard/plan (escritorio/móvil, plan/page.tsx). Antes el Almuerzo
// flexible tenía su propia versión y el resto ninguna — un solo lugar
// para que no se desincronicen de nuevo. Sin "use client": son strings
// puros, seguros desde Server y Client Components.
export function planCardWrapperClass(done: boolean): string {
  return done ? "border-success/40 bg-success/[0.06]" : "border-line bg-surface";
}

export function planCardCheckboxClass(done: boolean): string {
  return done ? "border-success bg-success text-white" : "border-line-strong text-transparent";
}

export function planCardTitleClass(done: boolean): string {
  return done ? "text-ink-dim line-through" : "text-ink";
}
