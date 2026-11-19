// Frases cortas y sobrias para los toasts de Plan — mismo tono que
// lib/habits/praise.ts (sin exagerar). Cuatro casos: subhábito (secundario,
// marcado desde el desplegable), bloque principal (is_minimum), "día
// cumplido" (todos los is_minimum de hoy en done con ESTE click) y racha
// (hito alcanzado o protector ganado).
const SECONDARY_PHRASES = [
  "Hecho.",
  "Sumado.",
  "Anotado.",
  "Listo, un paso más.",
  "Hecho — queda registrado.",
  "Anotado. Vas bien.",
  "Listo.",
  "Un paso más, hecho.",
  "Hecho, sin ruido.",
  "Anotado. Así se construye.",
];

const PRINCIPAL_PHRASES = [
  "Bloque cumplido.",
  "Listo — constancia sobre intensidad.",
  "Hecho. Un ladrillo más.",
  "Cumplido hoy. Eso cuenta.",
  "Hecho — seguís en pie.",
  "Anotado. Disciplina silenciosa.",
  "Listo, sin ruido.",
  "Hecho. El plan manda.",
  "Cumplido. Paso firme.",
  "Hecho — eso es lo que suma.",
];

const ALL_MINIMUMS_DONE_PHRASES = [
  "Día cumplido — todos los mínimos en pie.",
  "Completaste todo lo mínimo hoy. Buen cierre.",
  "Todos los mínimos del día, hechos.",
  "Día cerrado con todo cumplido.",
  "Cumpliste lo mínimo de hoy.",
  "Todo lo mínimo hecho hoy — constancia real.",
];

function pickRandom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickBlockPraise(result: { isMinimum: boolean; allMinimumsDone: boolean }): string {
  if (result.allMinimumsDone) return pickRandom(ALL_MINIMUMS_DONE_PHRASES);
  return pickRandom(result.isMinimum ? PRINCIPAL_PHRASES : SECONDARY_PHRASES);
}

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 100];

// Hito de racha cruzado con ESTE click (streakBefore < hito <= streakAfter)
// — null si no se cruzó ninguno.
export function streakMilestoneCrossed(streakBefore: number, streakAfter: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (streakBefore < m && streakAfter >= m) return m;
  }
  return null;
}

export function pickStreakMilestoneMessage(days: number): string {
  return `Racha de ${days} días. Constancia real.`;
}

export function pickProtectorGainedMessage(): string {
  return "Protector de racha ganado — 3 días seguidos cumplidos.";
}
