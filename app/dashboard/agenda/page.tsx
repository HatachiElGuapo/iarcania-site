import { and, asc, eq, ne, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";
import { tasks } from "@/lib/db/schema/trabajo";
import { appointments } from "@/lib/db/schema/citas";
import { CATS } from "@/lib/constants/cats";
import { createBlock, updateBlock, deleteBlock } from "./actions";
import { todayISO, addDaysISO as addDays } from "@/lib/date/bogota";

type Block = InferSelectModel<typeof agendaItems>;

const TYPE_META: Record<string, { icon: string; label: string; accent: string }> = {
  task: { icon: "✅", label: "Tarea", accent: "#9b72f0" },
  cita: { icon: "📞", label: "Cita", accent: "#C4A35A" },
  nota: { icon: "📝", label: "Nota", accent: "#5DCAA5" },
};

const ROW_PX = 16;
const DEFAULT_START = 6 * 60;
const DEFAULT_END = 22 * 60;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmt(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; pre?: string; edit?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { date: dateParam, pre, edit } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const isToday = date === todayISO();

  const [blocks, pendingTasks, citas] = await Promise.all([
    db
      .select()
      .from(agendaItems)
      .where(and(eq(agendaItems.userId, userId), eq(agendaItems.date, date)))
      .orderBy(asc(agendaItems.blockTime)),
    db
      .select({ id: tasks.id, title: tasks.title, category: tasks.category })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada"), ne(tasks.status, "completada")))
      .orderBy(asc(tasks.title)),
    db
      .select({ id: appointments.id, title: appointments.title, datetime: appointments.datetime })
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.status, "pendiente"))),
  ]);

  const taskById = new Map(pendingTasks.map((t) => [t.id, t]));
  const citaTitleById = new Map(citas.map((c) => [c.id, c.title]));
  const scheduledTaskIds = new Set(blocks.filter((b) => b.itemType === "task" && b.itemId).map((b) => b.itemId));
  const backlog = pendingTasks.filter((t) => !scheduledTaskIds.has(t.id));

  let windowStart = DEFAULT_START;
  let windowEnd = DEFAULT_END;
  for (const b of blocks) {
    const start = toMinutes(b.blockTime);
    const end = start + b.duration;
    windowStart = Math.min(windowStart, Math.floor(start / 60) * 60);
    windowEnd = Math.max(windowEnd, Math.ceil(end / 60) * 60);
  }
  const totalTicks = (windowEnd - windowStart) / 10;
  const totalScheduled = blocks.reduce((sum, b) => sum + b.duration, 0);
  const freeMinutes = Math.max(0, windowEnd - windowStart - totalScheduled);
  const freeTicks = Math.floor(freeMinutes / 10);

  const occupancy: { key: string; label: string; color: string; minutes: number }[] = [];
  const occByKey = new Map<string, { label: string; color: string; minutes: number }>();
  for (const b of blocks) {
    let key: string;
    let label: string;
    let color: string;
    if (b.itemType === "task") {
      const t = b.itemId ? taskById.get(b.itemId) : undefined;
      const c = t?.category ? CATS[t.category] : null;
      key = t?.category ?? "sin-categoria";
      label = c?.label ?? "Sin categoría";
      color = c?.color ?? "#4a4440";
    } else if (b.itemType === "cita") {
      key = "cita";
      label = "Citas";
      color = TYPE_META.cita.accent;
    } else {
      key = "nota";
      label = "Notas";
      color = TYPE_META.nota.accent;
    }
    const existing = occByKey.get(key);
    if (existing) existing.minutes += b.duration;
    else occByKey.set(key, { label, color, minutes: b.duration });
  }
  for (const [key, v] of occByKey) occupancy.push({ key, ...v });
  occupancy.sort((a, b) => b.minutes - a.minutes);

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  const editBlock = edit ? blocks.find((b) => b.id === edit) ?? null : null;

  return (
    <div className="space-y-5 p-8">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl text-text-primary">Agenda</h1>
          <p className="mt-0.5 text-xs text-text-dim">
            {dateLong} · rejilla de 10 min · {blocks.length} bloque{blocks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-bg-card">
          <a href={`/dashboard/agenda?date=${addDays(date, -1)}`} className="border-r border-border px-2.5 text-sm leading-none text-text-muted hover:text-text-primary flex items-center">
            ‹
          </a>
          <a
            href={`/dashboard/agenda?date=${todayISO()}`}
            className={`px-3.5 py-1.5 text-xs font-medium ${isToday ? "bg-bg-card-2 text-gold" : "text-text-muted hover:text-text-primary"}`}
          >
            {isToday ? "Hoy" : date}
          </a>
          <a href={`/dashboard/agenda?date=${addDays(date, 1)}`} className="border-l border-border px-2.5 text-sm leading-none text-text-muted hover:text-text-primary flex items-center">
            ›
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-bg-card text-[11.5px]">
            <span className="bg-bg-card-2 px-2.5 py-1.5 text-gold">10 min</span>
            <span className="border-l border-border px-2.5 py-1.5 text-text-muted">30 min</span>
            <span className="border-l border-border px-2.5 py-1.5 text-text-muted">1 h</span>
          </div>
          <span className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-xs text-text-muted">
            {fmt(windowStart)} – {fmt(windowEnd)}
          </span>
          <a href="#agregar-bloque" className="btn-primary">
            + Bloque
          </a>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/* Rejilla del día */}
        <div className="card-glow overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">Rejilla del día</span>
          </div>

          <div
            className="relative grid px-4 py-3"
            style={{ gridTemplateColumns: "48px 1fr", gridAutoRows: `${ROW_PX}px`, columnGap: "10px" }}
          >
            {Array.from({ length: totalTicks }, (_, i) => {
              const m = windowStart + i * 10;
              const onHour = m % 60 === 0;
              const onHalf = m % 60 === 30;
              return (
                <span
                  key={`t-${i}`}
                  style={{ gridColumn: 1, gridRow: i + 1 }}
                  className={`text-right tabular-nums leading-none ${onHour ? "text-[11px] text-text-muted" : "text-[10px] text-text-dim"}`}
                >
                  {onHour ? fmt(m) : onHalf ? ":30" : ""}
                </span>
              );
            })}
            {Array.from({ length: totalTicks }, (_, i) => {
              const m = windowStart + i * 10;
              const onHour = m % 60 === 0;
              return (
                <span
                  key={`l-${i}`}
                  style={{
                    gridColumn: 2,
                    gridRow: i + 1,
                    borderTop: `1px ${onHour ? "solid" : "dotted"} ${onHour ? "#1e1e1e" : "#151515"}`,
                  }}
                />
              );
            })}
            {blocks.map((b) => {
              const t = TYPE_META[b.itemType] ?? TYPE_META.nota;
              const start = toMinutes(b.blockTime);
              const row = (start - windowStart) / 10 + 1;
              const span = Math.max(1, Math.round(b.duration / 10));
              const label =
                b.itemType === "cita"
                  ? citaTitleById.get(b.itemId ?? "") ?? b.notes ?? "(sin título)"
                  : b.itemType === "task"
                    ? taskById.get(b.itemId ?? "")?.title ?? b.notes ?? "(sin título)"
                    : b.notes ?? "(sin título)";
              return (
                <div
                  key={b.id}
                  style={{
                    gridColumn: 2,
                    gridRow: `${row} / span ${span}`,
                    borderColor: `${t.accent}33`,
                    background: `${t.accent}10`,
                    borderLeftColor: t.accent,
                  }}
                  className="z-10 my-px flex items-center gap-2.5 overflow-hidden rounded-[7px] border border-l-[3px] px-2.5"
                >
                  <span className="shrink-0 text-xs">{t.icon}</span>
                  <span className="w-[76px] shrink-0 text-[11px] font-semibold tabular-nums text-text-primary">
                    {fmt(start)} – {fmt(start + b.duration)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-primary">{label}</span>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
                    style={{ background: `${t.accent}1f`, borderColor: `${t.accent}48`, color: t.accent }}
                  >
                    {t.label}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-text-muted">{b.duration} min</span>
                  <a href={`/dashboard/agenda?date=${date}&edit=${b.id}`} className="shrink-0 text-[10.5px] text-text-dim hover:text-text-muted">
                    Editar
                  </a>
                  <form action={deleteBlock}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="shrink-0 text-[10.5px] text-text-dim hover:text-red-400">
                      ✕
                    </button>
                  </form>
                </div>
              );
            })}
          </div>

          {editBlock && (
            <form
              action={updateBlock}
              className="flex flex-wrap items-center gap-2 border-t border-dashed border-border bg-bg-deep/40 p-3"
            >
              <input type="hidden" name="id" value={editBlock.id} />
              <span className="text-[11px] text-text-dim">Editando bloque de las {editBlock.blockTime}:</span>
              <input
                type="time"
                name="blockTime"
                step={600}
                defaultValue={editBlock.blockTime}
                required
                aria-label="Hora"
                className="rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-mid/50"
              />
              <input
                type="number"
                name="duration"
                defaultValue={editBlock.duration}
                min={10}
                step={10}
                aria-label="Duración en minutos"
                className="w-16 rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-mid/50"
              />
              <input
                type="text"
                name="notes"
                defaultValue={editBlock.notes ?? ""}
                placeholder="Notas…"
                aria-label="Notas"
                className="flex-1 rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-dim focus:border-purple-mid/50"
              />
              <button type="submit" className="btn-primary">
                Guardar
              </button>
              <a href={`/dashboard/agenda?date=${date}`} className="btn-secondary">
                Cancelar
              </a>
            </form>
          )}

          <form
            action={createBlock}
            id="agregar-bloque"
            className="flex flex-wrap items-center gap-2 border-t border-border bg-bg-card-2/40 p-3"
          >
            <input type="hidden" name="date" value={date} />
            <input
              type="time"
              name="blockTime"
              step={600}
              required
              aria-label="Hora"
              className="rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-mid/50"
            />
            <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-bg-card text-xs">
              <span className="flex items-center px-2 text-text-muted">−</span>
              <input
                type="number"
                name="duration"
                defaultValue={20}
                min={10}
                step={10}
                aria-label="Duración en minutos"
                className="w-14 border-x border-border bg-transparent px-1 py-1.5 text-center text-text-primary outline-none"
              />
              <span className="flex items-center px-2 text-text-muted">min</span>
            </div>
            <select
              name="itemType"
              defaultValue={pre ? "task" : "nota"}
              aria-label="Tipo de bloque"
              className="rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-muted outline-none"
            >
              <option value="nota">Nota libre</option>
              <option value="task">Tarea vinculada</option>
            </select>
            <select
              name="itemId"
              defaultValue={pre ?? ""}
              aria-label="Tarea a vincular"
              className="rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-muted outline-none"
            >
              <option value="">—</option>
              {pendingTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="notes"
              placeholder="Notas…"
              aria-label="Notas"
              className="min-w-[140px] flex-1 rounded-md border border-border bg-bg-card px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-dim"
            />
            <button type="submit" className="btn-primary">
              + Agregar
            </button>
          </form>
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-4">
          <div className="card-glow overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">Sin agendar</span>
              <span className="rounded-full border border-border bg-bg-card-2 px-2 py-0.5 text-[10px] text-text-muted">
                {backlog.length}
              </span>
            </div>
            {backlog.length === 0 ? (
              <p className="px-4 py-4 text-xs text-text-muted">Todo lo pendiente ya está agendado hoy.</p>
            ) : (
              <div className="flex flex-col gap-1.5 p-3">
                {backlog.map((t) => {
                  const c = t.category ? CATS[t.category] : null;
                  return (
                    <a
                      key={t.id}
                      href={`/dashboard/agenda?date=${date}&pre=${t.id}#agregar-bloque`}
                      style={{ borderLeftColor: c?.color ?? "#1e1e1e" }}
                      className="flex items-center gap-2.5 rounded-md border border-border border-l-[3px] bg-bg-deep px-2.5 py-1.5 text-[12px] text-text-primary hover:border-border-hover"
                    >
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <span className="shrink-0 text-[10px] text-text-dim">10 min</span>
                      <span className="shrink-0 text-text-dim">⠿</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {citas.length > 0 && (
            <div className="card-glow overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">Citas por agendar</span>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                {citas.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 rounded-md border border-gold/20 bg-gold/[0.04] px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-text-primary">{c.title}</div>
                      <div className="mt-0.5 text-[11px] text-gold">
                        {c.datetime.toLocaleString("es-CO", {
                          timeZone: "America/Bogota",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-text-dim">Agendar</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-glow p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              Ocupación {fmt(windowStart)} – {fmt(windowEnd)}
            </div>
            {occupancy.length === 0 ? (
              <p className="text-xs text-text-muted">Nada agendado todavía.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {occupancy.map((o) => (
                  <div key={o.key} className="flex items-center gap-2.5 text-xs text-text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: o.color }} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className="h-1 max-w-[74px] flex-1 overflow-hidden rounded-full bg-border">
                      <span
                        className="block h-full"
                        style={{ width: `${Math.min(100, (o.minutes / Math.max(1, totalScheduled)) * 100)}%`, background: o.color }}
                      />
                    </span>
                    <span className="min-w-[44px] shrink-0 text-right text-[11px] text-text-dim">{fmtDur(o.minutes)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-[11px] text-text-dim">
              Libre: {fmtDur(freeMinutes)} en {freeTicks} ticks sueltos
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
