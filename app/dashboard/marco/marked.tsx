import { MARCO_COLORS, type MarcoColor } from "@/lib/marco/colors";

// Parser del marcado inline de Marco: {color:frase}. Server-safe, sin
// dependencias. Leyenda de los 6 colores en docs/marco.md.
//   {rojo:x}  → colorea
//   {-:x}     → fuerza SIN color (override; el diccionario no la vuelve a tocar)
//   {xyz:x}   → color desconocido: se avisa por consola y se renderiza plano
const MARK = /\{([\w-]+):([^{}]*)\}/g;
const VALID = new Set<string>(MARCO_COLORS);

type Segment = { text: string; color: MarcoColor | null };

export function parseMarks(input: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(MARK)) {
    const [full, key, text] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, index), color: null });
    }
    if (key === "-") {
      segments.push({ text, color: null }); // override "sin color", sin aviso
    } else if (VALID.has(key)) {
      segments.push({ text, color: key as MarcoColor });
    } else {
      console.warn(`[marco] color desconocido "${key}" en: ${full}`);
      segments.push({ text, color: null });
    }
    lastIndex = index + full.length;
  }
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), color: null });
  }
  return segments;
}

export function Marked({ text }: { text: string }) {
  return (
    <>
      {parseMarks(text).map((s, i) =>
        s.color ? (
          <span key={i} style={{ color: `var(--marco-${s.color})` }}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
