"use client";

import { useState } from "react";
import { Input, Select, Textarea, Button, cx } from "@/components/ui";
import { createScript } from "./actions";

type Generated = { title: string; hook: string; body: string; cta: string; notes: string };

const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim";

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
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setMode("manual")}>
          + Nuevo guión
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setMode("ia")}
          className="border-accent-warm/40 text-accent-warm hover:border-accent-warm"
        >
          ✨ Generar con IA
        </Button>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <form
        action={crear}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <div>
          <label className={labelCls}>Título</label>
          <Input type="text" name="title" required />
        </div>
        <div>
          <label className={labelCls}>Canal</label>
          <Select name="canal" defaultValue="iarcania">
            <option value="iarcania">IArcanIA</option>
            <option value="voidstoic">Void Stoic</option>
          </Select>
        </div>
        <Button type="submit">Crear</Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Cancelar
        </Button>
      </form>
    );
  }

  // mode === 'ia'
  return (
    <div className="flex flex-col gap-3 rounded-ui-lg border border-dashed border-accent-warm/30 p-4">
      {!generated ? (
        <>
          <div className="flex gap-1">
            {(["idea", "preguntas"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setIaSubMode(m)}
                className={cx(
                  "focus-ring rounded-ui px-2 py-1 text-meta transition-colors duration-120",
                  iaSubMode === m ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {m === "idea" ? "Desde una idea" : "3 preguntas guiadas"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelCls}>Canal</label>
              <Select value={canal} onChange={(e) => setCanal(e.target.value)}>
                <option value="iarcania">IArcanIA</option>
                <option value="voidstoic">Void Stoic</option>
              </Select>
            </div>

            {iaSubMode === "idea" ? (
              <>
                <div className="flex-1">
                  <label className={labelCls}>Idea</label>
                  <Input
                    type="text"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    className="w-full"
                    placeholder="De qué va el video"
                  />
                </div>
                <div>
                  <label className={labelCls}>Formato</label>
                  <Select value={formato} onChange={(e) => setFormato(e.target.value)}>
                    <option value="Video largo">Video largo</option>
                    <option value="Video corto">Video corto</option>
                  </Select>
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>Modo</label>
                <Select
                  value={modoPreguntas}
                  onChange={(e) => setModoPreguntas(e.target.value as "pantalla" | "camara")}
                >
                  <option value="pantalla">Pantalla (IArcanIA)</option>
                  <option value="camara">Cámara (Void Stoic)</option>
                </Select>
              </div>
            )}
          </div>

          {iaSubMode === "preguntas" && (
            <div className="flex flex-col gap-2">
              <Input
                type="text"
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                placeholder="1. ¿Qué muestra o cómo arranca?"
                className="w-full"
              />
              <Input
                type="text"
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                placeholder="2. ¿Cuál es el problema o la tensión?"
                className="w-full"
              />
              <Input
                type="text"
                value={q3}
                onChange={(e) => setQ3(e.target.value)}
                placeholder="3. ¿Qué aprendiste o qué cambiaste?"
                className="w-full"
              />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={loading}
              onClick={iaSubMode === "idea" ? generarDesdeIdea : generarDesdePreguntas}
            >
              {loading ? "Generando…" : "Generar guión"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <form action={crear} className="flex flex-col gap-2">
          <input type="hidden" name="canal" value={canal} />
          <div>
            <label className={labelCls}>Título</label>
            <Input type="text" name="title" defaultValue={generated.title} required className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Hook</label>
            <Textarea name="hook" defaultValue={generated.hook} rows={2} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Desarrollo</label>
            <Textarea name="body" defaultValue={generated.body} rows={4} className="w-full" />
          </div>
          <div>
            <label className={labelCls}>Cierre</label>
            <Textarea name="cta" defaultValue={generated.cta} rows={2} className="w-full" />
          </div>
          {generated.notes && (
            <div>
              <label className={labelCls}>Notas</label>
              <Textarea name="notes" defaultValue={generated.notes} rows={2} className="w-full" />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit">Crear guión</Button>
            <Button type="button" variant="ghost" onClick={() => setGenerated(null)}>
              Volver
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
