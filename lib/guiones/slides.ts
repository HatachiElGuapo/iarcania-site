// Tipos de slide + generación heurística (sin IA). Puerto de
// js/estudio.js:888 generateSlides() al proyecto Next.js. Puro: se usa
// tanto en cliente (botón "Generar slides") como en servidor (validación
// en las server actions).

export const SLIDE_TIPOS = ["portada", "punto", "cita", "dato", "cierre"] as const;
export type SlideTipo = (typeof SLIDE_TIPOS)[number];

export function isSlideTipo(v: unknown): v is SlideTipo {
  return typeof v === "string" && (SLIDE_TIPOS as readonly string[]).includes(v);
}

// Forma mínima de un slide antes de persistir (sin id/orden/timestamps).
export type SlideDraft = {
  tipo: SlideTipo;
  textoPrincipal: string;
  textoSecundario?: string | null;
  notas?: string | null;
};

type ScriptContent = {
  titulo: string;
  hook?: string | null;
  body?: string | null;
  cta?: string | null;
};

export function generarSlidesHeuristico(s: ScriptContent): SlideDraft[] {
  const out: SlideDraft[] = [];
  const titulo = (s.titulo || "Sin título").trim();
  const hook = (s.hook || "").trim();
  const body = (s.body || "").trim();
  const cta = (s.cta || "").trim();

  // 1 · Portada — siempre.
  out.push({ tipo: "portada", textoPrincipal: titulo });

  // 2 · Hook → cita.
  if (hook) out.push({ tipo: "cita", textoPrincipal: hook });

  // 3 · Párrafos del desarrollo.
  if (body) {
    const parrafos = body
      .split(/\n{2,}|\n(?=[-•\d])/)
      .map((p) => p.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);

    for (const p of parrafos) {
      // Número/estadística explícita → dato.
      const numMatch =
        p.match(/^([\d.,%$]+[%x]?)\s*[-–—:]\s*(.+)$/) ||
        p.match(/^(.+?):\s*([\d.,%$]+[%x]?)$/);
      if (numMatch) {
        out.push({
          tipo: "dato",
          textoPrincipal: numMatch[1].trim(),
          textoSecundario: numMatch[2].trim(),
        });
        continue;
      }
      // Frase corta que arranca con número → dato.
      if (/^[\d.,%$]+/.test(p) && p.length < 30) {
        out.push({ tipo: "dato", textoPrincipal: p });
        continue;
      }
      // Pregunta → punto.
      if (p.startsWith("¿") || p.endsWith("?")) {
        out.push({ tipo: "punto", textoPrincipal: p });
        continue;
      }
      // Párrafo largo → punto, partido en principal + secundario.
      if (p.length > 100) {
        const frases = p.split(/(?<=[.!?])\s+/);
        out.push({
          tipo: "punto",
          textoPrincipal: frases[0],
          textoSecundario: frases.slice(1).join(" ") || null,
        });
      } else {
        out.push({ tipo: "punto", textoPrincipal: p });
      }
    }
  }

  // 4 · CTA → cierre.
  if (cta) out.push({ tipo: "cierre", textoPrincipal: cta });

  return out;
}
