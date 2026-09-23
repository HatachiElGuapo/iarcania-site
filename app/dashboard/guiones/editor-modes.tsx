"use client";

import { useMemo, useState } from "react";
import { Button, Input, Textarea, cx } from "@/components/ui";
import {
  bloquesFromScript,
  scriptFromBloques,
  organizarTextoLibre,
  WIZARD_STEPS,
  emptyWizard,
  wizardResumen,
  type Bloques,
  type HbcParts,
  type WizardAnswers,
} from "@/lib/guiones/editor";
import { hexToRgba, type BrandTheme } from "@/lib/guiones/brand-theme";

export type EditorModo = "libre" | "bloques" | "ia";

const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim";

const MODOS: { id: EditorModo; label: string }[] = [
  { id: "libre", label: "✍️ Libre" },
  { id: "bloques", label: "🧱 Bloques" },
  { id: "ia", label: "🤖 IA" },
];

// Componente controlado: el padre (ScriptCard) es dueño de hook/body/cta/
// notasIa/modo. Aquí solo cambia la UX de escritura y llama onPatch con el
// resultado colapsado a las 3 columnas.
export function EditorModes({
  canal,
  theme,
  modo,
  onModo,
  hook,
  body,
  cta,
  onPatch,
}: {
  canal: string;
  theme: BrandTheme;
  modo: EditorModo;
  onModo: (m: EditorModo) => void;
  hook: string;
  body: string;
  cta: string;
  onPatch: (p: Partial<HbcParts> & { notasIa?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModo(m.id)}
            className={cx(
              "focus-ring rounded-ui px-2.5 py-1 text-meta transition-colors duration-120",
              modo === m.id ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
            style={modo === m.id ? { background: hexToRgba(theme.primario, 0.18) } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      {modo === "libre" && (
        <ModoLibre hook={hook} body={body} cta={cta} onPatch={onPatch} />
      )}
      {modo === "bloques" && (
        <ModoBloques theme={theme} hook={hook} body={body} cta={cta} onPatch={onPatch} />
      )}
      {modo === "ia" && <ModoIA canal={canal} onPatch={onPatch} />}
    </div>
  );
}

/* ── Libre ────────────────────────────────────────────────── */
function ModoLibre({
  hook,
  body,
  cta,
  onPatch,
}: {
  hook: string;
  body: string;
  cta: string;
  onPatch: (p: Partial<HbcParts>) => void;
}) {
  const [texto, setTexto] = useState(() => [hook, body, cta].filter(Boolean).join("\n\n"));
  const [notas, setNotas] = useState<string[]>([]);
  const [nueva, setNueva] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
      <div className="flex flex-col gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          className="w-full"
          placeholder="Escribe el guión sin estructura. Cuando termines, «Organizar → Guion» lo reparte en hook / desarrollo / cierre."
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const r = organizarTextoLibre(texto);
              onPatch(r);
              setMsg(
                r.hook || r.cta
                  ? "Repartido en hook / desarrollo / cierre."
                  : "Sin señal clara: todo quedó en el desarrollo.",
              );
            }}
          >
            Organizar → Guion
          </Button>
          {msg && <span className="text-meta text-ink-muted">{msg}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-ui border border-line p-2">
        <span className={labelCls}>Notas / ideas sueltas</span>
        {notas.length === 0 && (
          <p className="text-meta text-ink-dim">Apunta ideas acá sin romper el flujo de escritura.</p>
        )}
        {notas.map((n, i) => (
          <div key={i} className="flex items-start gap-1 text-meta text-ink-muted">
            <span className="flex-1 whitespace-pre-wrap">{n}</span>
            <button
              type="button"
              onClick={() => setNotas((xs) => xs.filter((_, j) => j !== i))}
              className="text-ink-dim hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <Input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="w-full"
            placeholder="Nueva nota"
            onKeyDown={(e) => {
              if (e.key === "Enter" && nueva.trim()) {
                setNotas((xs) => [...xs, nueva.trim()]);
                setNueva("");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Bloques ──────────────────────────────────────────────── */
const BLOQUE_DEFS: { key: keyof Bloques; label: string; ph: string }[] = [
  { key: "inicio", label: "Inicio", ph: "Tu hook — la frase que engancha" },
  { key: "problema", label: "Problema", ph: "El dolor que tu audiencia reconoce" },
  { key: "desarrollo", label: "Desarrollo", ph: "Tu argumento — datos, historias, analogías" },
  { key: "cierre", label: "Cierre", ph: "Tu CTA — qué debe hacer el espectador" },
];

function ModoBloques({
  theme,
  hook,
  body,
  cta,
  onPatch,
}: {
  theme: BrandTheme;
  hook: string;
  body: string;
  cta: string;
  onPatch: (p: Partial<HbcParts>) => void;
}) {
  const [bloques, setBloques] = useState<Bloques>(() =>
    bloquesFromScript({ hook, body, cta }),
  );
  const [colapsado, setColapsado] = useState<Record<string, boolean>>({});

  function set(key: keyof Bloques, val: string) {
    const next = { ...bloques, [key]: val };
    setBloques(next);
    onPatch(scriptFromBloques(next));
  }

  return (
    <div className="flex flex-col gap-2">
      {BLOQUE_DEFS.map(({ key, label, ph }) => {
        const lleno = bloques[key].trim().length > 0;
        const cerrado = !!colapsado[key];
        return (
          <div
            key={key}
            className="rounded-ui border-l-[3px] bg-surface/40 p-2"
            style={{ borderLeftColor: theme.primario }}
          >
            <button
              type="button"
              onClick={() => setColapsado((c) => ({ ...c, [key]: !c[key] }))}
              className="flex w-full items-center gap-2 text-left"
            >
              <span
                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: lleno ? theme.primario : hexToRgba(theme.texto, 0.25) }}
              />
              <span className={labelCls + " mb-0"}>{label}</span>
              <span className="ml-auto text-[9px] text-ink-dim">{cerrado ? "▸" : "▾"}</span>
            </button>
            {!cerrado && (
              <Textarea
                value={bloques[key]}
                onChange={(e) => set(key, e.target.value)}
                rows={key === "desarrollo" ? 5 : 3}
                className="mt-1.5 w-full"
                placeholder={ph}
              />
            )}
          </div>
        );
      })}
      <p className="text-meta text-ink-dim">
        Se guarda como: Inicio → hook · Problema + Desarrollo → desarrollo · Cierre → cierre.
      </p>
    </div>
  );
}

/* ── IA (wizard) ──────────────────────────────────────────── */
function ModoIA({
  canal,
  onPatch,
}: {
  canal: string;
  onPatch: (p: Partial<HbcParts> & { notasIa?: string }) => void;
}) {
  const [answers, setAnswers] = useState<WizardAnswers>(emptyWizard);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HbcParts | null>(null);

  const last = step === WIZARD_STEPS.length - 1;
  const current = WIZARD_STEPS[step];
  const resumen = useMemo(() => wizardResumen(answers), [answers]);

  async function generar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizard: answers, canal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      const r: HbcParts = { hook: data.hook || "", body: data.body || "", cta: data.cta || "" };
      setResult(r);
      onPatch({ notasIa: resumen });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-2 rounded-ui border border-line p-3">
        <span className="text-meta text-ink-muted">Resultado — edítalo y aplícalo al guión:</span>
        {(["hook", "body", "cta"] as const).map((k) => (
          <div key={k}>
            <label className={labelCls}>{k === "hook" ? "Hook" : k === "body" ? "Desarrollo" : "Cierre"}</label>
            <Textarea
              value={result[k]}
              onChange={(e) => setResult({ ...result, [k]: e.target.value })}
              rows={k === "body" ? 5 : 2}
              className="w-full"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => onPatch(result)}>
            Usar en el guión
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setResult(null)}>
            Volver al wizard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-ui border border-line p-3">
      <div className="flex items-center gap-2">
        <span className="text-meta text-ink-dim">
          Paso {step + 1} / {WIZARD_STEPS.length}
        </span>
        <div className="ml-auto flex gap-0.5">
          {WIZARD_STEPS.map((_, i) => (
            <span
              key={i}
              className={cx("h-1 w-5 rounded-full", i <= step ? "bg-accent" : "bg-surface-2")}
            />
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>{current.q}</label>
        {current.kind === "duracion" ? (
          <div className="flex gap-1">
            {(["corto", "medio", "largo"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, duracion: d }))}
                className={cx(
                  "focus-ring rounded-ui border px-3 py-1.5 text-meta transition-colors duration-120",
                  answers.duracion === d
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line text-ink-muted hover:text-ink",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        ) : (
          <Textarea
            value={answers[current.key] as string}
            onChange={(e) => setAnswers((a) => ({ ...a, [current.key]: e.target.value }))}
            rows={2}
            className="w-full"
            placeholder={current.placeholder}
            autoFocus
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            ← Atrás
          </Button>
        )}
        {!last ? (
          <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
            Siguiente →
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={loading} onClick={generar}>
            {loading ? "Generando…" : "✨ Generar guión"}
          </Button>
        )}
      </div>
    </div>
  );
}
