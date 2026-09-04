import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts, scriptDerivados } from "@/lib/db/schema/guiones";
import {
  PageHeader,
  Segmented,
  Labeled,
  Input,
  Select,
  Button,
  EmptyState,
  cx,
} from "@/components/ui";
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
  iarcania: { label: "IArcanIA", color: "text-accent" },
  voidstoic: { label: "Void Stoic", color: "text-ink-muted" },
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
  borrador: "text-ink-dim",
  en_progreso: "text-accent-warm",
  listo_grabar: "text-accent",
  grabado: "text-ink-muted",
  publicado: "text-success",
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
  { key: "idea", label: "Idea", color: "text-ink-dim" },
  { key: "grabando", label: "Grabando", color: "text-ink-muted" },
  { key: "editando", label: "Editando", color: "text-accent-warm" },
  { key: "publicado", label: "Publicado", color: "text-success" },
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

  const canalOptions: [string, string][] = [
    ["all", "Todos"],
    ...Object.entries(CANALES).map(([id, c]) => [id, c.label] as [string, string]),
  ];

  return (
    <div className="p-8">
      <PageHeader
        icon="🗓️"
        title="Planner"
        tabs={
          <div className="flex flex-wrap items-center justify-between gap-3 pb-px">
            <Segmented
              className="border-0"
              options={TABS.map((t) => ({
                label: t.label,
                href: `/dashboard/planner?tab=${t.id}${canalFilter !== "all" ? `&canal=${canalFilter}` : ""}`,
                active: tab === t.id,
              }))}
            />
            <Segmented
              options={canalOptions.map(([id, label]) => ({
                label,
                href: `/dashboard/planner?tab=${tab}${id !== "all" ? `&canal=${id}` : ""}`,
                active: canalFilter === id,
              }))}
            />
          </div>
        }
      />

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
    <div className="flex flex-col gap-3">
      <details>
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          + Nueva pieza de contenido
        </summary>
        <form
          action={createScript}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Título">
            <Input name="title" required className="w-56" />
          </Labeled>
          <Labeled label="Canal">
            <Select name="canal" defaultValue="iarcania">
              {Object.entries(CANALES).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Formato">
            <Select name="formato" defaultValue="Video largo">
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_ICONS[f]} {f}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Plataforma origen">
            <Select name="plataformaOrigen" defaultValue="YouTube">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Fecha de grabación">
            <Input type="date" name="fechaGrabacion" className="w-40" />
          </Labeled>
          <Button type="submit">Crear</Button>
        </form>
      </details>

      {items.length === 0 ? (
        <EmptyState icon="📋">Todavía no has planeado ninguna pieza de contenido.</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
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
    <details className="rounded-ui-lg border border-line bg-surface p-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className={cx("text-meta font-semibold", canal.color)}>{canal.label}</span>
        <span className="text-meta text-ink-muted">
          {FORMAT_ICONS[script.formato] ?? ""} {script.formato}
        </span>
        <span className={cx("text-meta font-semibold", STATUS_COLOR[script.status])}>
          {STATUS_LABEL[script.status]}
        </span>
        <span className="flex-1 text-body font-semibold text-ink">{script.title}</span>
        {script.fechaGrabacion && (
          <span className="text-meta tabular-nums text-ink-dim">{script.fechaGrabacion}</span>
        )}
      </summary>

      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
        <a href="/dashboard/guiones" className="text-meta text-accent hover:underline">
          Editar guión (hook / desarrollo / cierre) en Guiones →
        </a>

        <form action={updatePlannerFields} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={script.id} />
          <Labeled label="Formato">
            <Select name="formato" defaultValue={script.formato}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Plataforma origen">
            <Select name="plataformaOrigen" defaultValue={script.plataformaOrigen}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Fecha grabación">
            <Input type="date" name="fechaGrabacion" defaultValue={script.fechaGrabacion ?? ""} className="w-40" />
          </Labeled>
          <Labeled label="Hora grabación">
            <Input type="time" name="horaGrab" defaultValue={script.horaGrab ?? ""} className="w-32" />
          </Labeled>
          <Labeled label="Hora publicación">
            <Input type="time" name="horaPub" defaultValue={script.horaPub ?? ""} className="w-32" />
          </Labeled>
          <Button type="submit" variant="secondary">
            Guardar
          </Button>
        </form>

        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Derivados ({derivados.length})
          </h3>
          {derivados.length === 0 ? (
            <p className="text-meta text-ink-dim">Sin derivados — el guión aplica al contenido origen.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {derivados.map((d) => {
                const est = DERIVADO_ESTADOS.find((e) => e.key === d.estado) ?? DERIVADO_ESTADOS[0];
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 rounded-ui bg-surface-sunken px-2 py-1.5 text-meta"
                  >
                    <span className="text-ink">{d.plataforma}</span>
                    <span className="text-ink-muted">{d.formato || "Clip"}</span>
                    {d.duracion && <span className="text-ink-dim">{d.duracion}s</span>}
                    <form action={updateDerivadoEstado} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={d.id} />
                      <Select name="estado" defaultValue={d.estado} className="py-0.5 text-meta">
                        {DERIVADO_ESTADOS.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                          </option>
                        ))}
                      </Select>
                      <button type="submit" className={cx("focus-ring", est.color)}>
                        Guardar
                      </button>
                    </form>
                    {d.notas && <span className="text-ink-dim">{d.notas}</span>}
                    <form action={deleteDerivado} className="ml-auto">
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="focus-ring text-ink-dim transition-colors duration-120 hover:text-danger"
                      >
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
            <Labeled label="Plataforma">
              <Select name="plataforma" defaultValue="TikTok">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Formato">
              <Input name="formato" placeholder="Short, Reel…" className="w-24" />
            </Labeled>
            <Labeled label="Duración (s)">
              <Input type="number" name="duracion" className="w-20" />
            </Labeled>
            <Labeled label="Notas">
              <Input name="notas" className="w-32" />
            </Labeled>
            <Button type="submit" variant="secondary">
              + Derivado
            </Button>
          </form>
        </div>

        <form action={deleteScript}>
          <input type="hidden" name="id" value={script.id} />
          <Button type="submit" variant="danger" size="sm">
            Eliminar
          </Button>
        </form>
      </div>
    </details>
  );
}

function ProduccionTab({ scripts: items }: { scripts: Script[] }) {
  if (items.length === 0) {
    return <EmptyState icon="🎬">No hay contenido en producción todavía.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => {
        const checklist = (s.checklist as Record<string, boolean>) || {};
        const done = STEPS.filter((st) => checklist[st.key]).length;
        const pct = Math.round((done / STEPS.length) * 100);
        return (
          <details key={s.id} className="rounded-ui-lg border border-line bg-surface p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className={cx("text-meta font-semibold", CANALES[s.canal]?.color ?? "")}>
                {CANALES[s.canal]?.label ?? s.canal}
              </span>
              <span className="flex-1 text-body font-semibold text-ink">{s.title}</span>
              <span className={cx("text-meta font-semibold", STATUS_COLOR[s.status])}>
                {STATUS_LABEL[s.status]}
              </span>
              <span className="text-meta tabular-nums text-ink-muted">{pct}%</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
              {STEPS.map((st) => (
                <form key={st.key} action={toggleChecklist}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="key" value={st.key} />
                  <input type="hidden" name="value" value={String(!checklist[st.key])} />
                  <button
                    type="submit"
                    className={cx(
                      "focus-ring rounded-ui border px-2 py-1 text-meta transition-colors duration-120",
                      checklist[st.key]
                        ? "border-success/40 text-success"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                    )}
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
    <div className="flex flex-col gap-2">
      <p className="text-meta tabular-nums text-ink-muted">Semana del {monday}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, i) => {
          const dayItems = items.filter((s) => s.fechaGrabacion === day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cx(
                "min-h-[100px] rounded-ui-lg border p-2",
                isToday ? "border-accent bg-accent-soft" : "border-line bg-surface",
              )}
            >
              <div
                className={cx("text-meta font-bold", isToday ? "text-accent" : "text-ink-muted")}
              >
                {DAY_NAMES[i]}
              </div>
              <div
                className={cx(
                  "text-body font-bold tabular-nums",
                  isToday ? "text-accent" : "text-ink",
                )}
              >
                {day.slice(8, 10)}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {dayItems.length === 0 && <div className="text-meta text-ink-dim">—</div>}
                {dayItems.map((s) => {
                  const ders = derivadosFor(s.id);
                  return (
                    <div key={s.id} className="rounded-ui bg-surface-sunken p-1.5 text-meta">
                      <div className={cx("font-semibold", CANALES[s.canal]?.color ?? "")}>
                        {s.title}
                      </div>
                      <div className="flex items-center gap-1 text-ink-dim">
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
