import type { MarcoColor } from "./colors";

// Diccionario de autocoloreado de Marco: palabra → color.
//
// CÓMO AMPLIARLO
//   Agregá una línea `palabra: "color",` en el grupo que corresponda.
//   Aplica en el próximo guardado de cualquier documento (la Server Action
//   updateMarcoDocument corre el diccionario antes de escribir). Para
//   reaplicarlo a lo ya guardado, corré scripts/marco-recolor.ts.
//
// REGLAS DEL CORPUS (docs/marco.md)
//   - una palabra, un solo color, en todas las frases;
//   - máximo 3 resaltados por frase (lo hace lib/marco/autocolor.ts);
//   - match por palabra entera, sin tildes y sin distinguir mayúsculas
//     ("Éxito" matchea la clave "éxito"; el marcado emitido conserva la
//     grafía original);
//   - frases de varias palabras ({rojo:no quieres}) van a mano, no acá;
//   - override: {rojo:x} fuerza color, {-:x} fuerza SIN color y el
//     diccionario no la vuelve a tocar.
export const COLOR_DICTIONARY: Record<string, MarcoColor> = {
  // ── rojo · tensión, precio, lo que duele / se paga / está en juego
  dolor: "rojo",
  precio: "rojo",
  pérdidas: "rojo",
  vergüenza: "rojo",
  rechazo: "rojo",
  excusas: "rojo",
  pasado: "rojo",
  perdedores: "rojo",
  bolsillos: "rojo",
  confinado: "rojo",
  disponible: "rojo",
  juzgues: "rojo",
  controlarán: "rojo",
  castigo: "rojo",
  pereza: "rojo",
  amor: "rojo",
  pecado: "rojo",
  vicio: "rojo",

  // ── verde · acción, construir, disciplina, el verbo que mueve
  fortaleza: "verde",
  escalar: "verde",
  ganar: "verde",
  presente: "verde",
  medicina: "verde",
  constancia: "verde",
  disciplina: "verde",
  controla: "verde",
  mejora: "verde",
  mejorar: "verde",
  extra: "verde",
  luchar: "verde",
  trabajar: "verde",
  asegúrate: "verde",
  espíritu: "verde",
  dedicar: "verde",

  // ── azul · mente, claridad, calma, dirección, estructura
  calmado: "azul",
  calma: "azul",
  claro: "azul",
  éxito: "azul",
  solo: "azul",
  elegir: "azul",
  pensamientos: "azul",
  paredes: "azul",
  diferencia: "azul",
  planes: "azul",
  decisiones: "azul",
  determinación: "azul",
  estructura: "azul",
  sereno: "azul",
  norte: "azul",
  tao: "azul",

  // ── morado · dualidades y opuestos internos (yin yang), emociones,
  //    libertad, propósito, y la identidad como principio: quién eres,
  //    qué defiendes
  ganadores: "morado",
  alma: "morado",
  propósito: "morado",
  aceptación: "morado",
  valioso: "morado",
  soledad: "morado",
  extraordinarias: "morado",
  vida: "morado",
  libertad: "morado",
  libre: "morado",
  yin: "morado",
  yang: "morado",

  // ── naranja · cifras, metas, fechas. Uso restringido; casi nunca por
  //    diccionario — va a mano donde de verdad hace falta.
};

export function normalizeWord(w: string): string {
  // minúsculas + quita marcas diacríticas (tildes, y ñ→n) tras NFD.
  return w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mapa de búsqueda con las claves normalizadas (sin tildes, minúsculas).
export const NORMALIZED_DICTIONARY: ReadonlyMap<string, MarcoColor> = new Map(
  Object.entries(COLOR_DICTIONARY).map(([k, v]) => [normalizeWord(k), v]),
);
