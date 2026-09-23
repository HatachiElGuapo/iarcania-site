"use client";

import { useState, type CSSProperties } from "react";
import { Input, Select, Textarea, Button, cx } from "@/components/ui";
import type { Script } from "./page";
import {
  updateScript,
  deleteScript,
  toggleChecklist,
  savePublicacion,
  savePresData,
} from "./actions";
import { EditorModes, type EditorModo } from "./editor-modes";
import { SlidePanel } from "./slide-panel";
import {
  hexToRgba,
  themeCssVars,
  defaultTheme,
  type BrandTheme,
} from "@/lib/guiones/brand-theme";

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
type Tab = "editar" | "slides" | "publicar" | "presentacion";
const TABS: { id: Tab; label: string }[] = [
  { id: "editar", label: "Editar" },
  { id: "slides", label: "Slides" },
  { id: "publicar", label: "Publicar" },
  { id: "presentacion", label: "Presentación" },
];

function toLocalInput(v: Date | string | null): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local usa hora local; slice a YYYY-MM-DDTHH:mm
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function ScriptCard({
  script,
  theme,
  themes,
  defaultExpanded,
}: {
  script: Script;
  theme: BrandTheme;
  themes: Record<string, BrandTheme>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [tab, setTab] = useState<Tab>("editar");

  const [title, setTitle] = useState(script.title);
  const [canal, setCanal] = useState(script.canal);
  const [status, setStatus] = useState(script.status);
  const [modo, setModo] = useState<EditorModo>(
    (["libre", "bloques", "ia"].includes(script.modoPreferido)
      ? script.modoPreferido
      : "bloques") as EditorModo,
  );
  const [hook, setHook] = useState(script.hook ?? "");
  const [body, setBody] = useState(script.body ?? "");
  const [cta, setCta] = useState(script.cta ?? "");
  const [notes, setNotes] = useState(script.notes ?? "");
  const [notasIa, setNotasIa] = useState(script.notasIa ?? "");
  const [fechaGrabacion, setFechaGrabacion] = useState(script.fechaGrabacion ?? "");
  const [fechaPublicacion, setFechaPublicacion] = useState(
    toLocalInput(script.fechaPublicacion as Date | string | null),
  );

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

  // Tema de marca vivo: cambia con el dropdown de canal (transición 300ms).
  const t = themes[canal] ?? theme ?? defaultTheme(canal);

  function onEditorPatch(p: { hook?: string; body?: string; cta?: string; notasIa?: string }) {
    if (p.hook !== undefined) setHook(p.hook);
    if (p.body !== undefined) setBody(p.body);
    if (p.cta !== undefined) setCta(p.cta);
    if (p.notasIa !== undefined) setNotasIa(p.notasIa);
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
        body: JSON.stringify({ canal, contenido }),
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
          body: JSON.stringify({ tipo, idea, canal, formato: formatoPres }),
        }).then((r) =>
          r.json().then((d) => {
            if (!r.ok) throw new Error(d.error || "Error del servidor");
            return d;
          }),
        );
      const [dataPres, dataAud] = await Promise.all([call("guion"), call("audiencia")]);
      const next: PresData = {
        presentador: { html: dataPres.html, filename: `presentador-${canal}-${ts}.html` },
        audiencia: { html: dataAud.html, filename: `audiencia-${canal}-${ts}.html` },
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
  const canalLabel = canal === "voidstoic" ? "Void Stoic" : "IArcanIA";

  const brandBox: CSSProperties = {
    ...themeCssVars(t),
    background: t.fondo,
    color: t.texto,
    borderColor: hexToRgba(t.primario, 0.35),
    transition:
      "background-color 300ms ease, border-color 300ms ease, color 300ms ease",
  };

  return (
    <div id={`script-${script.id}`} className="rounded-ui-lg border border-line bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="focus-ring flex w-full items-center gap-3 text-left"
      >
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: t.primario }}
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">{script.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-meta">
            <span className="font-semibold" style={{ color: t.primario }}>
              {canalLabel}
            </span>
            <span className={STATUS_COLOR[status] ?? "text-ink-dim"}>
              {STATUS_LABEL[status] ?? status}
            </span>
            <span className="tabular-nums text-ink-muted">{doneCount}/6</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
          <div className="flex gap-1">
            {TABS.map((tt) => (
              <button
                key={tt.id}
                type="button"
                onClick={() => setTab(tt.id)}
                className={cx(
                  "focus-ring rounded-ui px-2 py-1 text-meta transition-colors duration-120",
                  tab === tt.id ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {tt.label}
              </button>
            ))}
          </div>

          {tab === "editar" && (
            <div className="relative rounded-ui-lg border p-4" style={brandBox}>
              {t.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logoUrl}
                  alt=""
                  className="pointer-events-none absolute right-3 top-3 object-contain"
                  style={{ maxHeight: 28, maxWidth: 96, opacity: 0.5 }}
                />
              )}

              <form action={updateScript} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={script.id} />
                <input type="hidden" name="canal" value={canal} />
                <input type="hidden" name="modoPreferido" value={modo} />
                <input type="hidden" name="hook" value={hook} />
                <input type="hidden" name="body" value={body} />
                <input type="hidden" name="cta" value={cta} />
                <input type="hidden" name="notasIa" value={notasIa} />

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

                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[120px] flex-1">
                    <label className={labelCls}>Canal</label>
                    <Select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full">
                      <option value="iarcania">IArcanIA</option>
                      <option value="voidstoic">Void Stoic</option>
                    </Select>
                  </div>
                  <div className="min-w-[120px] flex-1">
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
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[150px] flex-1">
                    <label className={labelCls}>📹 Fecha grabación</label>
                    <Input
                      type="date"
                      name="fechaGrabacion"
                      value={fechaGrabacion}
                      onChange={(e) => setFechaGrabacion(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-[150px] flex-1">
                    <label className={labelCls}>🚀 Fecha publicación</label>
                    <Input
                      type="datetime-local"
                      name="fechaPublicacion"
                      value={fechaPublicacion}
                      onChange={(e) => setFechaPublicacion(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <EditorModes
                  canal={canal}
                  theme={t}
                  modo={modo}
                  onModo={setModo}
                  hook={hook}
                  body={body}
                  cta={cta}
                  onPatch={onEditorPatch}
                />

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
                      <label
                        key={item.key}
                        className="flex items-center gap-1 text-meta text-ink-muted"
                      >
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
                  <Button type="submit" style={{ background: t.primario, color: "#fff" }}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    href={`/dashboard/guiones/${script.id}/presentar`}
                  >
                    ▶ Presentar
                  </Button>
                  <Button
                    type="submit"
                    formAction={deleteScript}
                    variant="danger"
                    size="sm"
                    className="ml-auto"
                  >
                    Eliminar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {tab === "slides" && (
            <SlidePanel
              scriptId={script.id}
              theme={t}
              draft={{ titulo: title, hook, body, cta }}
            />
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
              <p className="text-meta text-ink-dim">
                Genera 2 HTML por IA: uno para ti (con estructura) y otro para la audiencia.
                Para un deck de slides navegable usa la pestaña <span className="text-ink">Slides</span>.
              </p>
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
