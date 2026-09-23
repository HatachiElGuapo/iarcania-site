"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, Input, Textarea, cx } from "@/components/ui";
import {
  SLIDE_TIPOS,
  generarSlidesHeuristico,
  type SlideDraft,
  type SlideTipo,
} from "@/lib/guiones/slides";
import { hexToRgba, type BrandTheme } from "@/lib/guiones/brand-theme";
import {
  addSlide,
  deleteSlide,
  getSlides,
  moveSlide,
  replaceSlides,
  updateSlide,
  type SlideRow,
} from "./slides-actions";
import { SlideView } from "./slide-view";

const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim";

// Contenido vivo del guión (del state del editor, sin guardar todavía) —
// para que "✨ Generar slides" use lo último escrito.
export type ScriptDraft = {
  titulo: string;
  hook: string;
  body: string;
  cta: string;
};

export function SlidePanel({
  scriptId,
  theme,
  draft,
}: {
  scriptId: string;
  theme: BrandTheme;
  draft: ScriptDraft;
}) {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideRow[] | null>(null); // null = cargando
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Carga perezosa: la lista de slides no viaja en el SSR de la página
  // (serían N queries por tarjeta). Se pide al montar el panel.
  useEffect(() => {
    let alive = true;
    getSlides(scriptId).then((r) => {
      if (!alive) return;
      if (r.ok) setSlides(r.slides);
      else {
        setError(r.error);
        setSlides([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [scriptId]);

  const list = slides ?? [];

  function run(fn: () => Promise<{ ok: boolean; error?: string; slides?: SlideRow[] }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error");
      else if (r.slides) setSlides(r.slides);
      router.refresh();
    });
  }

  function generar() {
    const drafts = generarSlidesHeuristico(draft);
    if (drafts.length <= 1 && !draft.hook && !draft.body && !draft.cta) {
      setError("Escribe el hook, el desarrollo o el cierre antes de generar.");
      return;
    }
    if (
      list.length &&
      !confirm(`Esto reemplaza los ${list.length} slides actuales con ${drafts.length} generados. ¿Seguir?`)
    )
      return;
    run(() => replaceSlides(scriptId, drafts));
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-ui-lg border p-3"
      style={{
        background: hexToRgba(theme.primario, 0.04),
        borderColor: hexToRgba(theme.primario, 0.25),
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-semibold text-ink">
          Slides <span className="text-ink-dim">({list.length})</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={generar}
            style={{ borderColor: hexToRgba(theme.acento, 0.5), color: theme.acento }}
          >
            ✨ Generar slides
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
            + Agregar
          </Button>
          {list.length > 0 && (
            <Button
              type="button"
              size="sm"
              href={`/dashboard/guiones/${scriptId}/presentar`}
            >
              ▶ Presentar
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {adding && (
        <SlideForm
          submitLabel="Agregar"
          disabled={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(d) => {
            run(() => addSlide(scriptId, d));
            setAdding(false);
          }}
        />
      )}

      {slides !== null && list.length === 0 && !adding ? (
        <p className="text-meta text-ink-muted">
          Sin slides. Usa <span className="text-ink">✨ Generar slides</span> desde el guión, o{" "}
          <span className="text-ink">+ Agregar</span> uno a mano.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((sl, i) => (
            <div key={sl.id} className="flex flex-col gap-1">
              <div
                className="group relative w-full overflow-hidden rounded-md"
                style={{
                  aspectRatio: "16 / 9",
                  background: theme.fondo,
                  border: `1px solid ${hexToRgba(theme.primario, 0.25)}`,
                }}
              >
                <SlideView slide={sl} theme={theme} variant="thumb" />

                <span
                  className="absolute left-1 top-1 rounded px-1 py-px text-[7px] font-bold uppercase tracking-wider"
                  style={{
                    background: hexToRgba(theme.primario, 0.16),
                    border: `1px solid ${hexToRgba(theme.primario, 0.35)}`,
                    color: theme.primario,
                  }}
                >
                  {sl.tipo}
                </span>
                <span className="absolute bottom-1 left-1.5 text-[8px] tabular-nums opacity-40" style={{ color: theme.texto }}>
                  {i + 1}
                </span>

                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {i > 0 && (
                    <IconBtn title="Subir" onClick={() => run(() => moveSlide(scriptId, sl.id, -1))} disabled={pending}>
                      ↑
                    </IconBtn>
                  )}
                  {i < list.length - 1 && (
                    <IconBtn title="Bajar" onClick={() => run(() => moveSlide(scriptId, sl.id, 1))} disabled={pending}>
                      ↓
                    </IconBtn>
                  )}
                  <IconBtn
                    title="Editar"
                    onClick={() => setEditingId(editingId === sl.id ? null : sl.id)}
                    disabled={pending}
                  >
                    ✎
                  </IconBtn>
                  <IconBtn
                    title="Eliminar"
                    danger
                    onClick={() => run(() => deleteSlide(scriptId, sl.id))}
                    disabled={pending}
                  >
                    ✕
                  </IconBtn>
                </div>
              </div>

              {editingId === sl.id && (
                <SlideForm
                  submitLabel="Guardar"
                  disabled={pending}
                  initial={{
                    tipo: sl.tipo as SlideTipo,
                    textoPrincipal: sl.textoPrincipal,
                    textoSecundario: sl.textoSecundario ?? "",
                    notas: sl.notas ?? "",
                  }}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(d) => {
                    run(() => updateSlide(scriptId, sl.id, d));
                    setEditingId(null);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex h-4 w-4 items-center justify-center rounded bg-black/55 text-[9px] leading-none text-white hover:bg-black/80 disabled:opacity-40",
        danger && "text-danger",
      )}
    >
      {children}
    </button>
  );
}

function SlideForm({
  initial,
  submitLabel,
  disabled,
  onSubmit,
  onCancel,
}: {
  initial?: Required<Pick<SlideDraft, "tipo">> & {
    textoPrincipal: string;
    textoSecundario: string;
    notas: string;
  };
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (d: SlideDraft) => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<SlideTipo>(initial?.tipo ?? "punto");
  const [principal, setPrincipal] = useState(initial?.textoPrincipal ?? "");
  const [secundario, setSecundario] = useState(initial?.textoSecundario ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");

  return (
    <div className="flex flex-col gap-2 rounded-ui border border-dashed border-line p-2">
      <div>
        <label className={labelCls}>Tipo</label>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as SlideTipo)} className="w-full">
          {SLIDE_TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className={labelCls}>Texto principal</label>
        <Textarea value={principal} onChange={(e) => setPrincipal(e.target.value)} rows={2} className="w-full" />
      </div>
      <div>
        <label className={labelCls}>Texto secundario</label>
        <Input value={secundario} onChange={(e) => setSecundario(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className={labelCls}>Notas del orador (solo tú)</label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full" />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !principal.trim()}
          onClick={() =>
            onSubmit({
              tipo,
              textoPrincipal: principal,
              textoSecundario: secundario || null,
              notas: notas || null,
            })
          }
        >
          {submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
