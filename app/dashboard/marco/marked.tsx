// Parser del marcado inline de Marco: {color:frase}. Server-safe, sin
// dependencias. 6 colores válidos — ver la leyenda en
// docs/sistema-de-diseno.md o el propio globals.css (--marco-*). Un color
// desconocido no rompe la vista: se avisa por consola y el texto se
// renderiza plano.
const MARK = /\{(\w+):([^{}]*)\}/g;

const VALID_COLORS = new Set([
  "rojo",
  "verde",
  "azul",
  "morado",
  "rosa",
  "naranja",
]);

type Segment = { text: string; color: string | null };

export function parseMarks(input: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(MARK)) {
    const [full, color, text] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, index), color: null });
    }
    if (VALID_COLORS.has(color)) {
      segments.push({ text, color });
    } else {
      console.warn(`[marco] color desconocido "${color}" en: ${full}`);
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
