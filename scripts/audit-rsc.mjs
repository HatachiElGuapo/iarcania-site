#!/usr/bin/env node
// npm run audit:rsc
//
// Guardia contra "Functions cannot be passed directly to Client
// Components": un Server Component (archivo .tsx sin "use client") que
// pasa una función armada ahí mismo (adaptador FormData→acción tipada,
// closure de onClick/onResult, etc.) a un componente — host element como
// <form> o uno "use client" — revienta en producción apenas React intenta
// serializarla para el cliente. Pasó dos veces ya: los botones +/- de
// Vicios/"trabajo" en app/dashboard/habitos/page.tsx envolvían la Server
// Action real en `async (fd) => { await accion(fd); }` en vez de pasarla
// directo.
//
// No hace análisis de tipos — es un lint de texto: busca, en archivos SIN
// "use client" (ni "use server", que son puras acciones, no JSX), cualquier
// prop con cara de handler (action, on<Algo>, render<Algo>) cuyo valor sea
// un literal de función armado ahí mismo (arrow function o `function`).
// Una Server Action importada y pasada tal cual (`action={miAccion}`) o
// con `.bind(...)` no matchea — son referencias válidas, no closures.
//
// Falsos positivos posibles (ej. un componente de UI puramente
// presentacional con su propio `action` HTML nativo que no cruza nada) se
// resuelven a mano: es un guardrail de texto, no un type-checker.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIR = join(ROOT, "app");

const HANDLER_PROP = /\b(action|on[A-Z]\w*|render(?:[A-Z]\w*)?)\s*=\s*\{\s*(async\s+)?(\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>|function\b)/g;

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
  return line;
}

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SCAN_DIR, []);
const findings = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  // La directiva debe ser el primer statement del archivo — alcanza con
  // mirar el arranque (no toleramos comentarios antes, igual que el resto
  // de esta base de código).
  const head = source.slice(0, 64).trimStart();
  const isClient = /^["']use client["']/.test(head);
  const isServerOnly = /^["']use server["']/.test(head);
  if (isClient || isServerOnly) continue;

  let match;
  HANDLER_PROP.lastIndex = 0;
  while ((match = HANDLER_PROP.exec(source))) {
    findings.push({
      file: relative(ROOT, file),
      line: lineAt(source, match.index),
      prop: match[1],
      snippet: source.slice(match.index, match.index + 80).replace(/\s+/g, " ").trim(),
    });
  }
}

if (findings.length === 0) {
  console.log("audit:rsc — OK, no se encontraron funciones armadas inline en Server Components.");
  process.exit(0);
}

console.error(`audit:rsc — ${findings.length} función(es) armada(s) inline en Server Components (prop cruza a un componente/host, no es una referencia a una Server Action):\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  prop "${f.prop}"\n    ${f.snippet}`);
}
console.error(
  "\nMové el adaptador a un archivo \"use server\" propio (o la Server Action tal cual, sin envolverla), o hacé que el componente cliente importe la acción y reciba solo datos planos.",
);
process.exit(1);
