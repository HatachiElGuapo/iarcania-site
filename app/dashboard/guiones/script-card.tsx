"use client";

import { useState } from "react";
import type { Script } from "./page";
import {
  updateScript,
  deleteScript,
  toggleChecklist,
  savePublicacion,
  savePresData,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_progreso: "En progreso",
  listo_grabar: "Listo para grabar",
  grabado: "Grabado",
  publicado: "Publicado",
};
const STATUS_COLOR: Record<string, string> = {
  borrador: "text-text-muted",
  en_progreso: "text-gold",
  listo_grabar: "text-purple-light",
  grabado: "text-blue-400",
  publicado: "text-green-400",
};
const CHECKLIST_ITEMS = [
  { key: "guion", label: "Guión" },
  { key: "imagenes", label: "Imágenes" },
  { key: "grabado", label: "Grabado" },
  { key: "editado", label: "Editado" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "publicado", label: "Publicado" },
];

type PresView = { html: string; filename: string };
type PresData = { presentador?: PresView; audiencia?: PresView; generado_en?: string };

export function ScriptCard({ script }: { script: Script }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"editar" | "publicar" | "presentacion">("editar");

  const [title, setTitle] = useState(script.title);
  const [status, setStatus] = useState(script.status);
  const [hook, setHook] = useState(script.hook ?? "");
  const [body, setBody] = useState(script.body ?? "");
  const [cta, setCta] = useState(script.cta ?? "");
  const [notes, setNotes] = useState(script.notes ?? "");
  const [fechaGrabacion, setFechaGrabacion] = useState(script.fechaGrabacion ?? "");

  const [libreText, setLibreText] = useState("");
  const [estructurando, setEstructurando] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    (script.checklist as Record<string, boolean>) || {},
  );

  const [videoUrl, setVideoUrl] = useState(script.videoUrl ?? "");
  const [plataformas, setPlataformas] = useState<string[]>(script.plataformas ?? []);
  const [copyYtTitulo, setCopyYtTitulo] = useState(script.copyYtTitulo ?? "");
  const [copyYtDescripcion, setCopyYtDescripcion] = useState(script.copyYtDescripcion ?? "");
  const [copyIgCaption, setCopyIgCaption] = useState(script.copyIgCaption ?? "");
  const [generandoCopy, setGenerandoCopy] = useState(false);

  const [formatoPres, setFormatoPres] = useState("largo");
  const [presData, setPresData] = useState<PresData>((script.presData as PresData) || {});
  const [generandoPres, setGenerandoPres] = useState(false);
  const [errorPres, setErrorPres] = useState<string | null>(null);

  async function estructurarConIA() {
    if (!libreText.trim()) return;
    setEstructurando(true);
    try {
      const res = await fetch("/api/scripts/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libre_text: libreText, canal: script.canal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setHook(data.hook || "");
      setBody(data.body || "");
      setCta(data.cta || "");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEstructurando(false);
    }
  }

  async function onToggleChecklist(key: string, value: boolean) {
    setChecklist((c) => ({ ...c, [key]: value }));
    const fd = new FormData();
    fd.set("id", script.id);
    fd.set("key", key);
    fd.set("value", String(value));
    await toggleChecklist(fd);
  }

  async function generarCopy() {
    const contenido = [title, hook, body, cta].filter(Boolean).join("\n\n");
    if (!contenido.trim()) {
      alert("El guión no tiene contenido");
      return;
    }
    setGenerandoCopy(true);
    try {
      const res = await fetch("/api/scripts/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal: script.canal, contenido }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setCopyYtTitulo(data.yt_titulo || "");
      setCopyYtDescripcion(data.yt_descripcion || "");
      setCopyIgCaption(data.ig_caption || "");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGenerandoCopy(false);
    }
  }

  async function generarPresentaciones() {
    const idea = [title, hook, body, cta].filter(Boolean).join("\n\n");
    if (!idea.trim()) {
      setErrorPres("El guión no tiene contenido aún");
      return;
    }
    setGenerandoPres(true);
    setErrorPres(null);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const call = (tipo: string) =>
        fetch("/api/scripts/presentacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo, idea, canal: script.canal, formato: formatoPres }),
        }).then((r) =>
          r.json().then((d) => {
            if (!r.ok) throw new Error(d.error || "Error del servidor");
            return d;
          }),
        );
      const [dataPres, dataAud] = await Promise.all([call("guion"), call("audiencia")]);
      const next: PresData = {
        presentador: { html: dataPres.html, filename: `presentador-${script.canal}-${ts}.html` },
        audiencia: { html: dataAud.html, filename: `audiencia-${script.canal}-${ts}.html` },
        generado_en: new Date().toISOString(),
      };
      setPresData(next);
      await savePresData(script.id, next);
    } catch (e) {
      setErrorPres((e as Error).message);
    } finally {
      setGenerandoPres(false);
    }
  }

  function descargar(view: PresView) {
    const blob = new Blob([view.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = view.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function ver(view: PresView) {
    const blob = new Blob([view.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const doneCount = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  const canalLabel = script.canal === "voidstoic" ? "Void Stoic" : "IArcanIA";
  const canalColor = script.canal === "voidstoic" ? "text-purple-light" : "text-red-400";

  return (
    <div className="rounded-md border border-border bg-bg-card p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">{script.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className={`font-semibold ${canalColor}`}>{canalLabel}</span>
            <span className={STATUS_COLOR[script.status]}>{STATUS_LABEL[script.status]}</span>
            <span className="text-text-muted">{doneCount}/6</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex gap-2 text-xs">
            {(["editar", "publicar", "presentacion"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-sm px-2 py-1 ${tab === t ? "bg-bg-deep text-text-primary" : "text-text-muted"}`}
              >
                {t === "editar" ? "Editar" : t === "publicar" ? "Publicar" : "Presentación"}
              </button>
            ))}
          </div>

          {tab === "editar" && (
            <div className="space-y-3">
              <div className="rounded-md border border-dashed border-border p-3">
                <label className="mb-1 block text-xs text-text-muted">
                  Pegar texto libre → estructurar con IA
                </label>
                <textarea
                  value={libreText}
                  onChange={(e) => setLibreText(e.target.value)}
                  rows={3}
                  className="input w-full"
                />
                <button
                  type="button"
                  disabled={estructurando}
                  onClick={estructurarConIA}
                  className="mt-2 rounded-sm border border-gold/40 px-3 py-1.5 text-xs text-gold hover:border-gold disabled:opacity-50"
                >
                  {estructurando ? "Estructurando…" : "✨ Estructurar con IA"}
                </button>
              </div>

              {/* El canal se fija al crear el guión — el original tampoco lo permitía editar después */}
              <form action={updateScript} className="space-y-2">
                <input type="hidden" name="id" value={script.id} />
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Título</label>
                  <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="input w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-muted">Estado</label>
                    <select
                      name="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="input w-full"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="listo_grabar">Listo para grabar</option>
                      <option value="grabado">Grabado</option>
                      <option value="publicado">Publicado</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-text-muted">Fecha grabación</label>
                    <input
                      type="date"
                      name="fechaGrabacion"
                      value={fechaGrabacion}
                      onChange={(e) => setFechaGrabacion(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Hook</label>
                  <textarea
                    name="hook"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    rows={2}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Desarrollo</label>
                  <textarea
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Cierre</label>
                  <textarea
                    name="cta"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    rows={2}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Notas de producción</label>
                  <textarea
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-text-muted">Checklist</label>
                  <div className="flex flex-wrap gap-3">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label key={item.key} className="flex items-center gap-1 text-xs text-text-muted">
                        <input
                          type="checkbox"
                          checked={!!checklist[item.key]}
                          onChange={(e) => onToggleChecklist(item.key, e.target.checked)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
                  >
                    Guardar
                  </button>
                  <button
                    type="submit"
                    formAction={deleteScript}
                    className="rounded-sm border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:border-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === "publicar" && (
            <form action={savePublicacion} className="space-y-2">
              <input type="hidden" name="id" value={script.id} />
              <div>
                <label className="mb-1 block text-xs text-text-muted">Link del video (Drive)</label>
                <input
                  type="url"
                  name="videoUrl"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="flex gap-4 text-xs text-text-muted">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name="plataformas"
                    value="youtube"
                    checked={plataformas.includes("youtube")}
                    onChange={(e) =>
                      setPlataformas((p) =>
                        e.target.checked ? [...p, "youtube"] : p.filter((x) => x !== "youtube"),
                      )
                    }
                  />
                  YouTube
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name="plataformas"
                    value="instagram"
                    checked={plataformas.includes("instagram")}
                    onChange={(e) =>
                      setPlataformas((p) =>
                        e.target.checked ? [...p, "instagram"] : p.filter((x) => x !== "instagram"),
                      )
                    }
                  />
                  Instagram
                </label>
              </div>
              <button
                type="button"
                disabled={generandoCopy}
                onClick={generarCopy}
                className="rounded-sm border border-gold/40 px-3 py-1.5 text-xs text-gold hover:border-gold disabled:opacity-50"
              >
                {generandoCopy ? "Generando…" : "✨ Generar copy con IA"}
              </button>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Título YouTube</label>
                <input
                  type="text"
                  name="copyYtTitulo"
                  value={copyYtTitulo}
                  onChange={(e) => setCopyYtTitulo(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Descripción YouTube</label>
                <textarea
                  name="copyYtDescripcion"
                  value={copyYtDescripcion}
                  onChange={(e) => setCopyYtDescripcion(e.target.value)}
                  rows={4}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Caption Instagram</label>
                <textarea
                  name="copyIgCaption"
                  value={copyIgCaption}
                  onChange={(e) => setCopyIgCaption(e.target.value)}
                  rows={3}
                  className="input w-full"
                />
              </div>
              <button
                type="submit"
                className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
              >
                Guardar publicación
              </button>
            </form>
          )}

          {tab === "presentacion" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Formato</label>
                  <select
                    value={formatoPres}
                    onChange={(e) => setFormatoPres(e.target.value)}
                    className="input"
                  >
                    <option value="largo">Largo</option>
                    <option value="corto">Corto</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={generandoPres}
                  onClick={generarPresentaciones}
                  className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple disabled:opacity-50"
                >
                  {generandoPres ? "Generando…" : "🎨 Generar presentaciones"}
                </button>
              </div>
              {errorPres && <p className="text-sm text-red-400">{errorPres}</p>}
              {presData.generado_en && (
                <p className="text-xs text-text-muted">
                  Generado{" "}
                  {new Date(presData.generado_en).toLocaleString("es-CO", {
                    timeZone: "America/Bogota",
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {presData.presentador && (
                  <div className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                    <span className="text-text-muted">Presentador</span>
                    <button type="button" onClick={() => ver(presData.presentador!)} className="text-purple-light">
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => descargar(presData.presentador!)}
                      className="text-purple-light"
                    >
                      Descargar
                    </button>
                  </div>
                )}
                {presData.audiencia && (
                  <div className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                    <span className="text-text-muted">Audiencia</span>
                    <button type="button" onClick={() => ver(presData.audiencia!)} className="text-purple-light">
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => descargar(presData.audiencia!)}
                      className="text-purple-light"
                    >
                      Descargar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
