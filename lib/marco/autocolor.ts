import { NORMALIZED_DICTIONARY, normalizeWord } from "./color-dictionary";

// Autocoloreado de Marco: materializa {color:palabra} en UNA frase (una
// línea de lista, un párrafo de prosa, o el intro). El llamador decide la
// granularidad — para listas se llama por línea, así el tope de 3 es por
// frase, como en el corpus.
//
// Idempotente: las marcas que ya existen ({color:x} o {-:x}) se detectan,
// su texto NO se vuelve a escanear, y las de color cuentan contra el tope
// de 3. El override {-:x} deja una palabra plana y a salvo del diccionario.

const MARK = /\{([\w-]+):([^{}]*)\}/g;
const WORD = /\p{L}+(?:['’-]\p{L}+)*/gu;
const MAX_HIGHLIGHTS = 3;

export function applyDictionary(frase: string): string {
  // 1. marcas explícitas → rangos bloqueados + conteo de las de color
  const locked: { start: number; end: number }[] = [];
  let explicitColored = 0;
  for (const m of frase.matchAll(MARK)) {
    const start = m.index ?? 0;
    locked.push({ start, end: start + m[0].length });
    if (m[1] !== "-") explicitColored++;
  }

  let budget = MAX_HIGHLIGHTS - explicitColored;
  if (budget <= 0) return frase;

  const inLocked = (i: number) => locked.some((r) => i >= r.start && i < r.end);

  // 2. candidatos del diccionario en el texto plano, primeros por posición
  const chosen: { start: number; end: number; word: string; color: string }[] = [];
  for (const w of frase.matchAll(WORD)) {
    if (budget <= 0) break;
    const start = w.index ?? 0;
    if (inLocked(start)) continue;
    const color = NORMALIZED_DICTIONARY.get(normalizeWord(w[0]));
    if (!color) continue;
    chosen.push({ start, end: start + w[0].length, word: w[0], color });
    budget--;
  }
  if (chosen.length === 0) return frase;

  // 3. reconstruir con las marcas nuevas insertadas
  let out = "";
  let cursor = 0;
  for (const c of chosen) {
    out += frase.slice(cursor, c.start);
    out += `{${c.color}:${c.word}}`;
    cursor = c.end;
  }
  out += frase.slice(cursor);
  return out;
}

// Aplica el diccionario a un bloque completo, frase por frase (línea por
// línea). Lo usan la Server Action y scripts/marco-recolor.ts.
export function autocolorBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => applyDictionary(line))
    .join("\n");
}
