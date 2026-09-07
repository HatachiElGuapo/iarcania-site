// Los 6 colores del marcado de Marco. Fuente única — la usan el parser
// (app/dashboard/marco/marked.tsx), el diccionario de autocoloreado y las
// custom properties --marco-* de app/globals.css. La leyenda de qué
// significa cada uno vive en docs/marco.md.
export const MARCO_COLORS = ["rojo", "verde", "azul", "morado", "rosa", "naranja"] as const;

export type MarcoColor = (typeof MARCO_COLORS)[number];
