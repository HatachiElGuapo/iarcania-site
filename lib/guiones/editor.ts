// Utilidades puras de los modos de editor (Libre / Bloques). Sin IA, sin
// imports de framework — se usan en el componente cliente editor-modes.tsx.
//
// Los 3 modos producen SIEMPRE el mismo resultado: { hook, body, cta } que
// se guardan en las 3 columnas de `scripts`. Cambia solo la UX de escritura.

export type HbcParts = { hook: string; body: string; cta: string };

// Primer párrafo vs. resto del `body` (para poblar Bloques al entrar).
export function splitBody(body: string | null | undefined): {
  first: string;
  rest: string;
} {
  const parts = (body || "").split(/\n{2,}/).map((p) => p.trim());
  return { first: parts[0] || "", rest: parts.slice(1).filter(Boolean).join("\n\n") };
}

// ── Modo Bloques ──────────────────────────────────────────────
export type Bloques = {
  inicio: string;
  problema: string;
  desarrollo: string;
  cierre: string;
};

export function bloquesFromScript(s: {
  hook?: string | null;
  body?: string | null;
  cta?: string | null;
}): Bloques {
  const { first, rest } = splitBody(s.body);
  return {
    inicio: s.hook || "",
    problema: first,
    desarrollo: rest,
    cierre: s.cta || "",
  };
}

export function scriptFromBloques(b: Bloques): HbcParts {
  return {
    hook: b.inicio.trim(),
    body: [b.problema.trim(), b.desarrollo.trim()].filter(Boolean).join("\n\n"),
    cta: b.cierre.trim(),
  };
}

// ── Modo Libre ────────────────────────────────────────────────
const CTA_RE =
  /(\b(suscr\w*|comenta\w*|comparte\w*|s[íi]gueme|escr[íi]beme|dime|link|enlace|prueba\w*|empieza|h[áa]zlo|descarga\w*|reserva\w*|ag[ée]ndalo)\b)|→|👇/i;

// Redistribuye texto libre en hook/body/cta con reglas simples.
// Si no hay señal clara, todo va a `body`.
export function organizarTextoLibre(text: string): HbcParts {
  const t = (text || "").trim();
  if (!t) return { hook: "", body: "", cta: "" };

  const paras = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paras.length >= 2) {
    const hook = paras[0];
    const last = paras[paras.length - 1];
    const ctaLike = CTA_RE.test(last) && last.length < 240;
    const cta = ctaLike ? last : "";
    const body = paras.slice(1, ctaLike ? -1 : undefined).join("\n\n");
    return { hook, body, cta };
  }

  // Un solo párrafo: intentar por oraciones.
  const sent = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  if (sent.length < 3) return { hook: "", body: t, cta: "" };

  const hook = sent[0];
  const last = sent[sent.length - 1];
  const ctaLike = CTA_RE.test(last);
  const cta = ctaLike ? last : "";
  const body = sent.slice(1, ctaLike ? -1 : undefined).join(" ");
  return { hook, body, cta };
}

// ── Wizard IA ─────────────────────────────────────────────────
export type WizardAnswers = {
  idea: string;
  audiencia: string;
  sentir: string;
  accion: string;
  material: string;
  duracion: "corto" | "medio" | "largo";
};

export const WIZARD_STEPS: {
  key: keyof WizardAnswers;
  q: string;
  placeholder: string;
  kind: "text" | "duracion";
}[] = [
  { key: "idea", q: "¿Cuál es la idea principal?", placeholder: "De qué va el video, en una frase", kind: "text" },
  { key: "audiencia", q: "¿A quién le hablas?", placeholder: "ej: fundadores de PYME que no saben por dónde empezar con IA", kind: "text" },
  { key: "sentir", q: "¿Qué quieres que sienta el espectador?", placeholder: "ej: que esto es más simple de lo que creía", kind: "text" },
  { key: "accion", q: "¿Qué quieres que haga después?", placeholder: "ej: que me escriba para una demo", kind: "text" },
  { key: "material", q: "¿Tienes datos o historias para incluir?", placeholder: "números, anécdotas, ejemplos concretos (opcional)", kind: "text" },
  { key: "duracion", q: "¿Qué tan largo es el video?", placeholder: "", kind: "duracion" },
];

export function emptyWizard(): WizardAnswers {
  return { idea: "", audiencia: "", sentir: "", accion: "", material: "", duracion: "medio" };
}

// Resumen legible de las respuestas — se guarda en scripts.notas_ia.
export function wizardResumen(w: WizardAnswers): string {
  return [
    `Idea: ${w.idea || "—"}`,
    `Audiencia: ${w.audiencia || "—"}`,
    `Debe sentir: ${w.sentir || "—"}`,
    `Debe hacer: ${w.accion || "—"}`,
    `Material: ${w.material || "—"}`,
    `Duración: ${w.duracion}`,
  ].join("\n");
}
