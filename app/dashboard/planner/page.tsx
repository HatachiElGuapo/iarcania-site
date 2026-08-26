import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts, scriptDerivados } from "@/lib/db/schema/guiones";
import { Field } from "@/components/ui/field";
import { todayISO, addDaysISO, BOGOTA_OFFSET } from "@/lib/date/bogota";
import { createScript, deleteScript, toggleChecklist } from "../guiones/actions";
import { updatePlannerFields, createDerivado, updateDerivadoEstado, deleteDerivado } from "./actions";

type Script = InferSelectModel<typeof scripts>;
type Derivado = InferSelectModel<typeof scriptDerivados>;

const TABS = [
  { id: "contenido", label: "📋 Contenido" },
  { id: "produccion", label: "🎬 Producción" },
  { id: "semanal", label: "📅 Semanal" },
];

const CANALES: Record<string, { label: string; color: string }> = {
  iarcania: { label: "IArcanIA", color: "text-purple-light" },
  voidstoic: { label: "Void Stoic", color: "text-blue-400" },
};

const FORMATS = ["Video largo", "Short", "Reel", "Carrusel", "Live", "Podcast"];
const FORMAT_ICONS: Record<string, string> = {
  "Video largo": "▶",
  Short: "⚡",
  Reel: "◎",
  Carrusel: "⊞",
  Live: "●",
  Podcast: "◉",
};
const PLATFORMS = ["YouTube", "TikTok", "Instagram"];

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

// Checklist compartido con Guiones — mismas 5 keys reales (CHECKLIST_KEYS
// de guiones/actions.ts, sin "imagenes" que no tiene equivalente en la UI
// de Planner). "Programar" del original no se migró como paso: ya está
// representado por si `fechaGrabacion`/`horaPub` tienen valor. Ver NOTES.md.
const STEPS: { key: string; label: string }[] = [
  { key: "guion", label: "Guión" },
  { key: "grabado", label: "Grabación" },
  { key: "editado", label: "Edición" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "publicado", label: "Publicar" },
];

const DERIVADO_ESTADOS = [
  { key: "idea", label: "Idea", color: "text-text-muted" },
  { key: "grabando", label: "Grabando", color: "text-blue-400" },
  { key: "editando", label: "Editando", color: "text-gold" },
  { key: "publicado", label: "Publicado", color: "text-green-400" },
];

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; canal?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tab: tabParam, canal: canalParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "contenido";
  const canalFilter = canalParam && CANALES[canalParam] ? canalParam : "all";

  const allScripts = await db
    .select()
    .from(scripts)
    .where(eq(scripts.userId, userId))
    .orderBy(asc(scripts.fechaGrabacion));
  const filtered = canalFilter === "all" ? allScripts : allScripts.filter((s) => s.canal === canalFilter);

  const allDerivados = await db.select().from(scriptDerivados).where(eq(scriptDerivados.userId, userId));
  const derivadosFor = (scriptId: string) => allDerivados.filter((d) => d.scriptId === scriptId);

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Planner</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`/dashboard/planner?tab=${t.id}${canalFilter !== "all" ? `&canal=${canalFilter}` : ""}`}
              className={`rounded-sm px-3 py-1.5 ${
                tab === t.id ? "bg-bg-card text-text-primary" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          {[["all", "Todos"], ...Object.entries(CANALES).map(([id, c]) => [id, c.label])].map(([id, label]) => (
            <a
              key={id}
              href={`/dashboard/planner?tab=${tab}${id !== "all" ? `&canal=${id}` : ""}`}
              className={`rounded-sm px-2 py-1 ${
                canalFilter === id ? "bg-bg-card text-text-primary" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {tab === "contenido" && <ContenidoTab scripts={filtered} derivadosFor={derivadosFor} />}
      {tab === "produccion" && <ProduccionTab scripts={filtered} />}
      {tab === "semanal" && <SemanalTab scripts={filtered} derivadosFor={derivadosFor} />}
    </div>
  );
}

function ContenidoTab({
  scripts: items,
  derivadosFor,
}: {
  scripts: Script[];
  derivadosFor: (id: string) => Derivado[];
}) {
  return (
    <div className="space-y-3">
      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nueva pieza de contenido</summary>
        <form
          action={createScript}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Título">
            <input type="text" name="title" required className="input" />
          </Field>
          <Field label="Canal">
            <select name="canal" defaultValue="iarcania" className="input">
              {Object.entries(CANALES).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Formato">
            <select name="formato" defaultValue="Video largo" className="input">
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_ICONS[f]} {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plataforma origen">
            <select name="plataformaOrigen" defaultValue="YouTube" className="input">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de grabación">
            <input type="date" name="fechaGrabacion" className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Crear
          </button>
        </form>
      </details>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Sin contenido todavía.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <ContenidoCard key={s.id} script={s} derivados={derivadosFor(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContenidoCard({ script, derivados }: { script: Script; derivados: Derivado[] }) {
  const canal = CANALES[script.canal] ?? CANALES.iarcania;
  return (
    <details className="rounded-md border border-border bg-bg-card p-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold ${canal.color}`}>{canal.label}</span>
        <span className="text-xs text-text-muted">
          {FORMAT_ICONS[script.formato] ?? ""} {script.formato}
        </span>
        <span className={`text-xs font-semibold ${STATUS_COLOR[script.status]}`}>
          {STATUS_LABEL[script.status]}
        </span>
        <span className="flex-1 text-sm font-semibold text-text-primary">{script.title}</span>
        {script.fechaGrabacion && <span className="text-xs text-text-muted">{script.fechaGrabacion}</span>}
      </summary>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <a href="/dashboard/guiones" className="text-xs text-purple-light hover:underline">
          Editar guión (hook / desarrollo / cierre) en Guiones →
        </a>

        <form action={updatePlannerFields} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={script.id} />
          <Field label="Formato">
            <select name="formato" defaultValue={script.formato} className="input">
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plataforma origen">
            <select name="plataformaOrigen" defaultValue={script.plataformaOrigen} className="input">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha grabación">
            <input type="date" name="fechaGrabacion" defaultValue={script.fechaGrabacion ?? ""} className="input" />
          </Field>
          <Field label="Hora grabación">
            <input type="time" name="horaGrab" defaultValue={script.horaGrab ?? ""} className="input" />
          </Field>
          <Field label="Hora publicación">
            <input type="time" name="horaPub" defaultValue={script.horaPub ?? ""} className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            Guardar
          </button>
        </form>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Derivados ({derivados.length})
          </h3>
          {derivados.length === 0 ? (
            <p className="text-xs text-text-dim">Sin derivados — el guión aplica al contenido origen</p>
          ) : (
            <div className="space-y-1">
              {derivados.map((d) => {
                const est = DERIVADO_ESTADOS.find((e) => e.key === d.estado) ?? DERIVADO_ESTADOS[0];
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-sm bg-bg-deep/50 px-2 py-1.5 text-xs">
                    <span className="text-text-primary">{d.plataforma}</span>
                    <span className="text-text-muted">{d.formato || "Clip"}</span>
                    {d.duracion && <span className="text-text-dim">{d.duracion}s</span>}
                    <form action={updateDerivadoEstado} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={d.id} />
                      <select name="estado" defaultValue={d.estado} className="input py-0.5 text-xs">
                        {DERIVADO_ESTADOS.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={est.color}>
                        Guardar
                      </button>
                    </form>
                    {d.notas && <span className="text-text-dim">{d.notas}</span>}
                    <form action={deleteDerivado} className="ml-auto">
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="text-text-muted hover:text-red-400">
                        ×
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
          <form action={createDerivado} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="scriptId" value={script.id} />
            <Field label="Plataforma">
              <select name="plataforma" defaultValue="TikTok" className="input">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Formato">
              <input type="text" name="formato" placeholder="Short, Reel…" className="input w-24" />
            </Field>
            <Field label="Duración (s)">
              <input type="number" name="duracion" className="input w-20" />
            </Field>
            <Field label="Notas">
              <input type="text" name="notas" className="input w-32" />
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              + Derivado
            </button>
          </form>
        </div>

        <form action={deleteScript}>
          <input type="hidden" name="id" value={script.id} />
          <button
            type="submit"
            className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400"
          >
            Eliminar
          </button>
        </form>
      </div>
    </details>
  );
}

function ProduccionTab({ scripts: items }: { scripts: Script[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sin contenido para mostrar.</p>;
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const checklist = (s.checklist as Record<string, boolean>) || {};
        const done = STEPS.filter((st) => checklist[st.key]).length;
        const pct = Math.round((done / STEPS.length) * 100);
        return (
          <details key={s.id} className="rounded-md border border-border bg-bg-card p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className={`text-xs font-semibold ${CANALES[s.canal]?.color ?? ""}`}>
                {CANALES[s.canal]?.label ?? s.canal}
              </span>
              <span className="flex-1 text-sm font-semibold text-text-primary">{s.title}</span>
              <span className={`text-xs font-semibold ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
              <span className="text-xs text-text-muted">{pct}%</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
              {STEPS.map((st) => (
                <form key={st.key} action={toggleChecklist}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="key" value={st.key} />
                  <input type="hidden" name="value" value={String(!checklist[st.key])} />
                  <button
                    type="submit"
                    className={`rounded-sm border px-2 py-1 text-xs ${
                      checklist[st.key]
                        ? "border-green-500/40 text-green-400"
                        : "border-border text-text-muted hover:border-purple-mid"
                    }`}
                  >
                    {checklist[st.key] ? "✓ " : ""}
                    {st.label}
                  </button>
                </form>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function SemanalTab({
  scripts: items,
  derivadosFor,
}: {
  scripts: Script[];
  derivadosFor: (id: string) => Derivado[];
}) {
  const today = todayISO();
  const dow = new Date(`${today}T12:00:00${BOGOTA_OFFSET}`).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDaysISO(today, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">Semana del {monday}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, i) => {
          const dayItems = items.filter((s) => s.fechaGrabacion === day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`min-h-[100px] rounded-md border p-2 ${
                isToday ? "border-purple-mid bg-purple-mid/5" : "border-border bg-bg-card"
              }`}
            >
              <div className={`text-xs font-bold ${isToday ? "text-purple-light" : "text-text-muted"}`}>
                {DAY_NAMES[i]}
              </div>
              <div className={`text-sm font-bold ${isToday ? "text-purple-light" : "text-text-primary"}`}>
                {day.slice(8, 10)}
              </div>
              <div className="mt-1 space-y-1">
                {dayItems.length === 0 && <div className="text-xs text-text-dim">—</div>}
                {dayItems.map((s) => {
                  const ders = derivadosFor(s.id);
                  return (
                    <div key={s.id} className="rounded-sm bg-bg-deep/50 p-1.5 text-xs">
                      <div className={`font-semibold ${CANALES[s.canal]?.color ?? ""}`}>{s.title}</div>
                      <div className="flex items-center gap-1 text-text-dim">
                        {FORMAT_ICONS[s.formato]} {s.plataformaOrigen}
                        {s.horaGrab && ` · ${s.horaGrab}`}
                        {ders.length > 0 && ` · +${ders.length}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
