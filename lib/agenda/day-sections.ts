// Límites de las 3 secciones de "Tu día" (rutina matutina / tu día / rutina
// nocturna) — configuración de código, NO se infiere del texto de los
// bloques: cualquier bloque que empiece antes de MORNING_END cae en
// "Rutina matutina", cualquiera que empiece a EVENING_START o después cae
// en "Rutina nocturna", el resto en la sección principal "Tu día". Un
// bloque flexible (plan_blocks.flexible) usa EVENING_START como su propia
// hora de vencimiento en vez de su end_time (ver lib/plan/pending.ts).
export const MORNING_END = "07:00";
export const EVENING_START = "18:00";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export const MORNING_END_MIN = toMinutes(MORNING_END);
export const EVENING_START_MIN = toMinutes(EVENING_START);
