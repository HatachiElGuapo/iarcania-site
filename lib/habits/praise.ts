// Frases cortas y sobrias para el toast que aparece al marcar un hábito
// hecho — sin exagerar (nada de "¡ERES INCREÍBLE!"), solo una señal de que
// quedó anotado. Tres pools: genérico (hábito no-diario, caso raro — los
// "Vicios" son contadores y no pasan por aquí), principal (hábito diario,
// el caso normal) y "día cumplido" (se acaban de completar TODOS los
// hábitos diarios de hoy) — este último tiene prioridad.
const GENERIC_PHRASES = [
  "Hecho.",
  "Sumado.",
  "Anotado — buen avance.",
  "Listo, un paso más.",
  "Hecho. Seguís en pie.",
  "Anotado. Vas bien.",
  "Hecho — constancia que suma.",
  "Listo.",
  "Un paso más, hecho.",
  "Anotado. Así se construye.",
];

const PRINCIPAL_PHRASES = [
  "Hábito cumplido. Así se construye.",
  "Listo — constancia sobre intensidad.",
  "Hecho. Un ladrillo más.",
  "Cumplido hoy. Eso cuenta.",
  "Hecho — seguís en pie.",
  "Anotado. Disciplina silenciosa.",
  "Listo, sin ruido.",
  "Hecho. El hábito manda.",
  "Cumplido. Paso firme.",
  "Hecho — eso es lo que suma.",
];

const ALL_DONE_PHRASES = [
  "Día cumplido — todos los hábitos en pie.",
  "Completaste todo hoy. Buen cierre.",
  "Todos los hábitos del día, hechos.",
  "Día cerrado con todo cumplido.",
  "Cumpliste todo lo de hoy.",
  "Todo hecho hoy — constancia real.",
];

function pickRandom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickHabitPraise(result: {
  isPrincipal: boolean;
  allPrincipalDone: boolean;
  hasParent?: boolean;
  parentJustCompleted?: boolean;
}): string {
  // Un hijo (tiene parent_id) siempre es un toast corto — salvo que con
  // ESE click haya completado a su padre, ahí se festeja como un hábito
  // (ver app/dashboard/habitos/actions.ts, toggleLogToday).
  if (result.hasParent) {
    return result.parentJustCompleted ? pickRandom(PRINCIPAL_PHRASES) : pickRandom(GENERIC_PHRASES);
  }
  if (result.allPrincipalDone) return pickRandom(ALL_DONE_PHRASES);
  return pickRandom(result.isPrincipal ? PRINCIPAL_PHRASES : GENERIC_PHRASES);
}
