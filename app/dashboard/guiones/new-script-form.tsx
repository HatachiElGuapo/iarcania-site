"use client";

import { useState } from "react";
import { createScript } from "./actions";

type Generated = { title: string; hook: string; body: string; cta: string; notes: string };

export function NewScriptForm() {
  const [mode, setMode] = useState<"closed" | "manual" | "ia">("closed");
  const [iaSubMode, setIaSubMode] = useState<"idea" | "preguntas">("idea");
  const [modoPreguntas, setModoPreguntas] = useState<"pantalla" | "camara">("pantalla");
  const [canal, setCanal] = useState("iarcania");
  const [idea, setIdea] = useState("");
  const [formato, setFormato] = useState("Video largo");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);

  function reset() {
    setMode("closed");
    setGenerated(null);
    setError(null);
    setIdea("");
    setQ1("");
    setQ2("");
    setQ3("");
  }

  async function generarDesdeIdea() {
    if (!idea.trim()) {
      setError("Escribe una idea primero");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, canal, formato }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setGenerated({
        title: data.titulo || idea,
        hook: data.hook || "",
        body: data.body || "",
        cta: data.cta || "",
        notes: data.notas || "",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generarDesdePreguntas() {
    if (!q1.trim() || !q2.trim() || !q3.trim()) {
      setError("Responde las 3 preguntas");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: modoPreguntas, q1, q2, q3, canal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setGenerated({
        title: "Guión sin título",
        hook: data.hook || "",
        body: data.body || "",
        cta: data.cta || "",
        notes: "",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function crear(fd: FormData) {
    await createScript(fd);
    reset();
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="rounded-sm border border-border px-3 py-1.5 text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nuevo guión
        </button>
        <button
          type="button"
          onClick={() => setMode("ia")}
          className="rounded-sm border border-gold/40 px-3 py-1.5 text-gold hover:border-gold"
        >
          ✨ Generar con IA
        </button>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <form
        action={crear}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <div>
          <label className="mb-1 block text-xs text-text-muted">Título</label>
          <input type="text" name="title" required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-muted">Canal</label>
          <select name="canal" defaultValue="iarcania" className="input">
            <option value="iarcania">IArcanIA</option>
            <option value="voidstoic">Void Stoic</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          Crear
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-border px-3 py-2 text-sm text-text-muted"
        >
          Cancelar
        </button>
      </form>
    );
  }

  // mode === 'ia'
  return (
    <div className="space-y-3 rounded-md border border-dashed border-gold/30 p-4">
      {!generated ? (
        <>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIaSubMode("idea")}
              className={`rounded-sm px-2 py-1 ${iaSubMode === "idea" ? "bg-bg-card text-text-primary" : "text-text-muted"}`}
            >
              Desde una idea
            </button>
            <button
              type="button"
              onClick={() => setIaSubMode("preguntas")}
              className={`rounded-sm px-2 py-1 ${iaSubMode === "preguntas" ? "bg-bg-card text-text-primary" : "text-text-muted"}`}
            >
              3 preguntas guiadas
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Canal</label>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                className="input"
              >
                <option value="iarcania">IArcanIA</option>
                <option value="voidstoic">Void Stoic</option>
              </select>
            </div>

            {iaSubMode === "idea" ? (
              <>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-text-muted">Idea</label>
                  <input
                    type="text"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    className="input w-full"
                    placeholder="De qué va el video"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Formato</label>
                  <select
                    value={formato}
                    onChange={(e) => setFormato(e.target.value)}
                    className="input"
                  >
                    <option value="Video largo">Video largo</option>
                    <option value="Video corto">Video corto</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs text-text-muted">Modo</label>
                <select
                  value={modoPreguntas}
                  onChange={(e) => setModoPreguntas(e.target.value as "pantalla" | "camara")}
                  className="input"
                >
                  <option value="pantalla">Pantalla (IArcanIA)</option>
                  <option value="camara">Cámara (Void Stoic)</option>
                </select>
              </div>
            )}
          </div>

          {iaSubMode === "preguntas" && (
            <div className="space-y-2">
              <input
                type="text"
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                placeholder="1. ¿Qué muestra o cómo arranca?"
                className="input w-full"
              />
              <input
                type="text"
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                placeholder="2. ¿Cuál es el problema o la tensión?"
                className="input w-full"
              />
              <input
                type="text"
                value={q3}
                onChange={(e) => setQ3(e.target.value)}
                placeholder="3. ¿Qué aprendiste o qué cambiaste?"
                className="input w-full"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={iaSubMode === "idea" ? generarDesdeIdea : generarDesdePreguntas}
              className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple disabled:opacity-50"
            >
              {loading ? "Generando…" : "Generar guión"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-sm border border-border px-3 py-2 text-sm text-text-muted"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <form action={crear} className="space-y-2">
          <input type="hidden" name="canal" value={canal} />
          <div>
            <label className="mb-1 block text-xs text-text-muted">Título</label>
            <input type="text" name="title" defaultValue={generated.title} required className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Hook</label>
            <textarea name="hook" defaultValue={generated.hook} rows={2} className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Desarrollo</label>
            <textarea name="body" defaultValue={generated.body} rows={4} className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Cierre</label>
            <textarea name="cta" defaultValue={generated.cta} rows={2} className="input w-full" />
          </div>
          {generated.notes && (
            <div>
              <label className="mb-1 block text-xs text-text-muted">Notas</label>
              <textarea name="notes" defaultValue={generated.notes} rows={2} className="input w-full" />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
            >
              Crear guión
            </button>
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className="rounded-sm border border-border px-3 py-2 text-sm text-text-muted"
            >
              Volver
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
