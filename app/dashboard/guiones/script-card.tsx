"use client";

import { useState } from "react";
import { Input, Select, Textarea, Button, cx } from "@/components/ui";
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
  borrador: "text-ink-dim",
  en_progreso: "text-accent-warm",
  listo_grabar: "text-accent",
  grabado: "text-ink-muted",
  publicado: "text-success",
};
const CHECKLIST_ITEMS = [
  { key: "guion", label: "Guión" },
  { key: "imagenes", label: "Imágenes" },
  { key: "grabado", label: "Grabado" },
  { key: "editado", label: "Editado" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "publicado", label: "Publicado" },
];

const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim";

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
  const canalColor = script.canal === "voidstoic" ? "text-ink-muted" : "text-accent";

  return (
    <div className="rounded-ui-lg border border-line bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="focus-ring flex w-full items-center gap-3 text-left"
      >
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">{script.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-meta">
            <span className={cx("font-semibold", canalColor)}>{canalLabel}</span>
            <span className={STATUS_COLOR[script.status]}>{STATUS_LABEL[script.status]}</span>
            <span className="tabular-nums text-ink-muted">{doneCount}/6</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
          <div className="flex gap-1">
            {(["editar", "publicar", "presentacion"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cx(
                  "focus-ring rounded-ui px-2 py-1 text-meta transition-colors duration-120",
                  tab === t ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {t === "editar" ? "Editar" : t === "publicar" ? "Publicar" : "Presentación"}
              </button>
            ))}
          </div>

          {tab === "editar" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-ui-lg border border-dashed border-line p-3">
                <label className={labelCls}>Pegar texto libre → estructurar con IA</label>
                <Textarea
                  value={libreText}
                  onChange={(e) => setLibreText(e.target.value)}
                  rows={3}
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={estructurando}
                  onClick={estructurarConIA}
                  className="mt-2 border-accent-warm/40 text-accent-warm hover:border-accent-warm"
                >
                  {estructurando ? "Estructurando…" : "✨ Estructurar con IA"}
                </Button>
              </div>

              {/* El canal se fija al crear el guión — el original tampoco lo permitía editar después */}
              <form action={updateScript} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={script.id} />
                <div>
                  <label className={labelCls}>Título</label>
                  <Input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelCls}>Estado</label>
                    <Select
                      name="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="listo_grabar">Listo para grabar</option>
                      <option value="grabado">Grabado</option>
                      <option value="publicado">Publicado</option>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className={labelCls}>Fecha grabación</label>
                    <Input
                      type="date"
                      name="fechaGrabacion"
                      value={fechaGrabacion}
                      onChange={(e) => setFechaGrabacion(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Hook</label>
                  <Textarea
                    name="hook"
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    rows={2}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Desarrollo</label>
                  <Textarea
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Cierre</label>
                  <Textarea
                    name="cta"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    rows={2}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Notas de producción</label>
                  <Textarea
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className={labelCls}>Checklist</label>
                  <div className="flex flex-wrap gap-3">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label key={item.key} className="flex items-center gap-1 text-meta text-ink-muted">
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
                  <Button type="submit">Guardar</Button>
                  <Button type="submit" formAction={deleteScript} variant="danger" size="sm">
                    Eliminar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {tab === "publicar" && (
            <form action={savePublicacion} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={script.id} />
              <div>
                <label className={labelCls}>Link del video (Drive)</label>
                <Input
                  type="url"
                  name="videoUrl"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-4 text-meta text-ink-muted">
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={generandoCopy}
                onClick={generarCopy}
                className="w-fit border-accent-warm/40 text-accent-warm hover:border-accent-warm"
              >
                {generandoCopy ? "Generando…" : "✨ Generar copy con IA"}
              </Button>
              <div>
                <label className={labelCls}>Título YouTube</label>
                <Input
                  type="text"
                  name="copyYtTitulo"
                  value={copyYtTitulo}
                  onChange={(e) => setCopyYtTitulo(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>Descripción YouTube</label>
                <Textarea
                  name="copyYtDescripcion"
                  value={copyYtDescripcion}
                  onChange={(e) => setCopyYtDescripcion(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>Caption Instagram</label>
                <Textarea
                  name="copyIgCaption"
                  value={copyIgCaption}
                  onChange={(e) => setCopyIgCaption(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>
              <Button type="submit" className="w-fit">
                Guardar publicación
              </Button>
            </form>
          )}

          {tab === "presentacion" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelCls}>Formato</label>
                  <Select value={formatoPres} onChange={(e) => setFormatoPres(e.target.value)}>
                    <option value="largo">Largo</option>
                    <option value="corto">Corto</option>
                  </Select>
                </div>
                <Button type="button" disabled={generandoPres} onClick={generarPresentaciones}>
                  {generandoPres ? "Generando…" : "🎨 Generar presentaciones"}
                </Button>
              </div>
              {errorPres && <p className="text-sm text-danger">{errorPres}</p>}
              {presData.generado_en && (
                <p className="text-meta text-ink-muted">
                  Generado{" "}
                  {new Date(presData.generado_en).toLocaleString("es-CO", {
                    timeZone: "America/Bogota",
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {presData.presentador && (
                  <div className="flex items-center gap-2 rounded-ui-lg border border-line p-2 text-meta">
                    <span className="text-ink-muted">Presentador</span>
                    <button type="button" onClick={() => ver(presData.presentador!)} className="focus-ring text-accent">
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => descargar(presData.presentador!)}
                      className="focus-ring text-accent"
                    >
                      Descargar
                    </button>
                  </div>
                )}
                {presData.audiencia && (
                  <div className="flex items-center gap-2 rounded-ui-lg border border-line p-2 text-meta">
                    <span className="text-ink-muted">Audiencia</span>
                    <button type="button" onClick={() => ver(presData.audiencia!)} className="focus-ring text-accent">
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => descargar(presData.audiencia!)}
                      className="focus-ring text-accent"
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
