import { and, asc, eq, gte, lte, lt, ne, isNull, type InferSelectModel, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { agendaItems } from "@/lib/db/schema/agenda";
import { Field } from "@/components/ui/field";
import { CATS } from "@/lib/constants/cats";
import {
  createTask,
  toggleTaskStatus,
  archiveTask,
  unarchiveTask,
  deleteTask,
} from "./actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";

type Task = InferSelectModel<typeof tasks>;

const TIEMPO_TABS: { id: string; label: string; icon: string }[] = [
  { id: "todas", label: "Todas", icon: "≡" },
  { id: "hoy", label: "Hoy", icon: "☀" },
  { id: "semana", label: "Semana", icon: "▤" },
  { id: "vencidas", label: "Vencidas", icon: "!" },
  { id: "completadas", label: "Completadas", icon: "✓" },
  { id: "sinfecha", label: "Sin fecha", icon: "∅" },
];

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-red-400",
  media: "text-gold",
  baja: "text-text-muted",
};

const PRIORITY_BADGE: Record<string, string> = {
  alta: "bg-red-500/10 text-red-400",
  media: "bg-gold/10 text-gold",
  baja: "bg-white/5 text-text-muted",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tiempoWhere(tiempo: string, today: string, weekEnd: string): SQL[] {
  const conditions: SQL[] = [ne(tasks.status, "archivada")];
  if (tiempo === "completadas") {
    conditions.push(eq(tasks.status, "completada"));
  } else if (tiempo === "vencidas") {
    conditions.push(lt(tasks.dueDate, today));
    conditions.push(ne(tasks.status, "completada"));
  } else if (tiempo === "hoy") {
    conditions.push(eq(tasks.dueDate, today));
    conditions.push(ne(tasks.status, "completada"));
  } else if (tiempo === "semana") {
    conditions.push(gte(tasks.dueDate, today));
    conditions.push(lte(tasks.dueDate, weekEnd));
    conditions.push(ne(tasks.status, "completada"));
  } else if (tiempo === "sinfecha") {
    conditions.push(isNull(tasks.dueDate));
    conditions.push(ne(tasks.status, "completada"));
  } else {
    conditions.push(ne(tasks.status, "completada"));
  }
  return conditions;
}

export default async function ActividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tiempo?: string; cat?: string; archivadas?: string; open?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tiempo: tiempoParam, cat, archivadas, open } = await searchParams;
  const tiempo = TIEMPO_TABS.find((t) => t.id === tiempoParam)?.id ?? "todas";
  const showArchived = archivadas === "1";
  const today = todayISO();
  const weekEnd = addDaysISO(today, 7);
  const monthStart = today.slice(0, 8) + "01";

  if (showArchived) {
    const archivedRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "archivada")))
      .orderBy(asc(tasks.dueDate));

    return (
      <div className="space-y-5 p-8">
        <div className="flex items-center justify-between">
          <h1 className="mb-0.5 text-[26px] text-text-primary">Archivadas</h1>
          <a href="/dashboard/actividades" className="text-xs text-text-muted hover:text-gold">
            ← Ver activas
          </a>
        </div>
        {archivedRows.length === 0 ? (
          <p className="text-sm text-text-muted">No hay tareas archivadas.</p>
        ) : (
          <div className="card-glow divide-y divide-border">
            {archivedRows.map((task) => {
              const cat = task.category ? CATS[task.category] : null;
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-text-dim">{task.title}</span>
                  {cat && (
                    <span className="text-[10px]" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                  )}
                  <form action={unarchiveTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="text-xs text-text-muted hover:text-gold">
                      Restaurar
                    </button>
                  </form>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="text-xs text-text-muted hover:text-red-400">
                      Eliminar
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const [rows, archivedIds, tabCountsRaw, breakdownRows, completedMonthIds] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ...tiempoWhere(tiempo, today, weekEnd), ...(cat ? [eq(tasks.category, cat)] : [])))
      .orderBy(asc(tasks.dueDate), asc(tasks.timeDue)),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "archivada"))),
    Promise.all(
      TIEMPO_TABS.map((t) =>
        db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), ...tiempoWhere(t.id, today, weekEnd), ...(cat ? [eq(tasks.category, cat)] : [])))
          .then((r) => [t.id, r.length] as const),
      ),
    ),
    db
      .select({ category: tasks.category, priority: tasks.priority })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada"), ne(tasks.status, "completada"))),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "completada"), gte(tasks.dueDate, monthStart))),
  ]);

  const archivedCount = archivedIds.length;
  const tabCounts = Object.fromEntries(tabCountsRaw);
  const completedThisMonth = completedMonthIds.length;

  const catCounts: Record<string, number> = {};
  const prioCounts: Record<string, number> = {};
  for (const r of breakdownRows) {
    if (r.category) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1;
    prioCounts[r.priority] = (prioCounts[r.priority] ?? 0) + 1;
  }

  const openId = (open && rows.some((r) => r.id === open) ? open : rows[0]?.id) ?? null;
  const openTask = openId ? rows.find((r) => r.id === openId) ?? null : null;
  const openBlock = openTask
    ? (
        await db
          .select()
          .from(agendaItems)
          .where(and(eq(agendaItems.userId, userId), eq(agendaItems.itemType, "task"), eq(agendaItems.itemId, openTask.id)))
          .limit(1)
      )[0]
    : undefined;

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (tiempo !== "todas") params.set("tiempo", tiempo);
    if (cat) params.set("cat", cat);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/dashboard/actividades?${s}` : "/dashboard/actividades";
  };

  function TaskRow({ task }: { task: Task }) {
    const isOverdue = task.dueDate && task.dueDate < today && task.status !== "completada";
    const c = task.category ? CATS[task.category] : null;
    const isOpen = task.id === openId;
    return (
      <div
        className={`flex items-center gap-2.5 border-b border-white/[0.045] px-2.5 py-2 last:border-0 ${
          isOpen ? "bg-white/[0.03]" : ""
        }`}
        style={{ borderLeft: `2px solid ${isOverdue ? "#f87171" : task.status === "completada" ? "#1e1e1e" : (c?.color ?? "#1e1e1e")}` }}
      >
        <form action={toggleTaskStatus}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="nextStatus" value={task.status === "completada" ? "pendiente" : "completada"} />
          <button
            type="submit"
            className={`flex h-4 w-4 items-center justify-center rounded border text-[9px] text-white ${
              task.status === "completada" ? "border-purple-mid bg-purple-mid" : "border-border"
            }`}
            aria-label="Cambiar estado"
          >
            {task.status === "completada" ? "✓" : ""}
          </button>
        </form>
        <a
          href={qs({ open: task.id })}
          className={`min-w-0 flex-1 truncate text-[12.5px] ${
            task.status === "completada" ? "text-text-dim line-through" : "text-text-primary"
          }`}
        >
          {task.title}
        </a>
        {c && (
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px]" style={{ color: c.color }}>
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: c.color }} />
            {c.label}
          </span>
        )}
        <span
          className={`w-[52px] shrink-0 rounded-full py-0.5 text-center text-[9.5px] font-semibold uppercase ${PRIORITY_BADGE[task.priority] ?? ""}`}
        >
          {task.priority}
        </span>
        <span className={`w-[88px] shrink-0 text-right text-[11px] tabular-nums ${isOverdue ? "text-red-400" : "text-text-muted"}`}>
          {task.dueDate ? task.dueDate.replace(`${today.slice(0, 4)}-`, "") : "sin fecha"}
        </span>
        <details className="group relative shrink-0">
          <summary className="cursor-pointer list-none px-0.5 text-xs leading-none text-text-dim marker:content-none hover:text-text-muted">
            ⋯
          </summary>
          <div className="absolute right-0 top-5 z-20 flex w-32 flex-col gap-0.5 rounded-md border border-border bg-bg-card p-1.5 shadow-xl">
            <a href={`/dashboard/agenda?pre=${task.id}`} className="rounded-sm px-2 py-1 text-left text-[11px] text-text-muted hover:bg-white/5 hover:text-text-primary">
              Agendar
            </a>
            <form action={archiveTask}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className="w-full rounded-sm px-2 py-1 text-left text-[11px] text-text-muted hover:bg-white/5 hover:text-text-primary">
                Archivar
              </button>
            </form>
            <form action={deleteTask}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className="w-full rounded-sm px-2 py-1 text-left text-[11px] text-text-muted hover:bg-white/5 hover:text-red-400">
                Eliminar
              </button>
            </form>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-8">
      <div className="grid items-start gap-4 lg:grid-cols-[190px_1fr_300px]">
        {/* Rail de filtros */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">Vistas</div>
            <div className="flex flex-col gap-0.5">
              {TIEMPO_TABS.map((t) => (
                <a
                  key={t.id}
                  href={qs({ tiempo: t.id === "todas" ? undefined : t.id })}
                  className={`flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] ${
                    tiempo === t.id ? "bg-bg-card-2 text-text-primary" : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <span className="w-3.5 shrink-0 text-center text-[11px]">{t.icon}</span>
                  <span className="flex-1">{t.label}</span>
                  <span className={`text-[11px] ${tiempo === t.id ? "text-gold" : "text-text-dim"}`}>
                    {tabCounts[t.id] ?? 0}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">Categorías</div>
            <div className="flex flex-col gap-0.5">
              {Object.entries(CATS).map(([key, c]) => (
                <a
                  key={key}
                  href={qs({ cat: cat === key ? undefined : key })}
                  className={`flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] ${
                    cat === key ? "bg-bg-card-2 text-text-primary" : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="text-[11px] text-text-dim">{catCounts[key] ?? 0}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">Prioridad</div>
            <div className="flex flex-col gap-0.5">
              {(["alta", "media", "baja"] as const).map((p) => (
                <div key={p} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-text-muted">
                  <span className="h-4 w-4 shrink-0 rounded border border-[#262626]" />
                  <span className={`flex-1 capitalize ${PRIORITY_COLOR[p]}`}>{p}</span>
                  <span className="text-[11px] text-text-dim">{prioCounts[p] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-3 text-[11.5px] text-text-dim">
            <a href={qs({ archivadas: "1" })} className="text-left hover:text-text-muted">
              Archivadas ({archivedCount})
            </a>
            <a href={qs({ tiempo: "completadas" })} className="text-left hover:text-text-muted">
              Completadas este mes ({completedThisMonth})
            </a>
          </div>
        </div>

        {/* Lista */}
        <div className="flex flex-col rounded-md border border-border">
          <div className="flex items-center gap-3 rounded-t-md px-3 py-2.5">
            <div>
              <h1 className="text-[21px] text-text-primary">Actividades</h1>
              <p className="mt-0.5 text-[11.5px] text-text-dim">
                {tabCounts["todas"] ?? 0} activas · {tabCounts["vencidas"] ?? 0} vencidas · orden por fecha
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-[11.5px]">
              <span className="rounded-[7px] border border-border bg-bg-card px-2.5 py-1.5 text-text-muted">Vence ↑</span>
              <span className="rounded-[7px] border border-border bg-bg-card px-2.5 py-1.5 text-text-muted">Agrupar ▾</span>
              <span className="rounded-[7px] border border-border bg-bg-card px-2.5 py-1.5 text-text-muted">⌘K</span>
            </div>
          </div>

          <div className="border-t border-border px-3 pb-2.5 pt-2">
            <form action={createTask}>
              <div className="flex items-center gap-2 rounded-md border border-border bg-bg-card px-3 py-2">
                <span className="text-[13px] text-purple-mid">+</span>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Escribe una tarea y presiona Enter…"
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text-primary outline-none placeholder:text-text-dim"
                />
                <span className="shrink-0 text-[11px] text-text-dim/70">hoy · media</span>
                <button type="submit" className="sr-only">
                  Agregar
                </button>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[10.5px] text-text-dim hover:text-text-muted">
                  + opciones (categoría, prioridad, fecha)
                </summary>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <Field label="Categoría">
                    <select name="category" defaultValue={cat ?? ""} className="input">
                      <option value="">Sin categoría</option>
                      {Object.entries(CATS).map(([key, c]) => (
                        <option key={key} value={key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Prioridad">
                    <select name="priority" defaultValue="media" className="input">
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </Field>
                  <Field label="Vence">
                    <input type="date" name="dueDate" defaultValue={today} className="input" />
                  </Field>
                  <Field label="Hora inicio">
                    <input type="time" name="timeDue" className="input" />
                  </Field>
                  <Field label="Hora fin">
                    <input type="time" name="timeEnd" className="input" />
                  </Field>
                </div>
              </details>
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="border-t border-border px-3 py-6 text-center text-sm text-text-muted">No hay tareas para este filtro.</p>
          ) : (
            <div className="flex flex-col border-t border-border">
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 rounded-b-md border-t border-border bg-bg-card-2/40 px-3 py-2 text-[11px] text-text-dim">
            <span>{rows.length} visibles</span>
            <span className="ml-auto">
              Seleccionadas: 0 · <span className="text-text-muted">Completar</span> · <span className="text-text-muted">Agendar</span> ·{" "}
              <span className="text-text-muted">Archivar</span>
            </span>
          </div>
        </div>

        {/* Detalle */}
        <div className="card-glow overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">Detalle</span>
            <span className="ml-auto text-[11px] text-text-dim">Esc para cerrar</span>
          </div>
          {!openTask ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">Selecciona una tarea para ver el detalle.</p>
          ) : (
            <div className="flex flex-col gap-3.5 p-4">
              <div>
                <div className="text-[15px] leading-snug text-text-primary">{openTask.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_BADGE[openTask.priority] ?? ""}`}
                  >
                    {openTask.priority}
                  </span>
                  {openTask.category && CATS[openTask.category] && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px]"
                      style={{
                        background: `${CATS[openTask.category].color}1f`,
                        border: `1px solid ${CATS[openTask.category].color}48`,
                        color: CATS[openTask.category].color,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-sm" style={{ background: CATS[openTask.category].color }} />
                      {CATS[openTask.category].label}
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted">{openTask.status}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { label: "Categoría", value: openTask.category && CATS[openTask.category] ? CATS[openTask.category].label : "Sin categoría" },
                  { label: "Prioridad", value: capitalize(openTask.priority) },
                  { label: "Vence", value: openTask.dueDate ?? "Sin fecha" },
                  {
                    label: "Hora",
                    value: openTask.timeDue ? `${openTask.timeDue}${openTask.timeEnd ? ` – ${openTask.timeEnd}` : ""}` : "Sin hora",
                  },
                  { label: "Agenda", value: openBlock ? `Bloque ${openBlock.blockTime} · ${openBlock.duration} min` : "Sin agendar" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5">
                    <span className="w-16 shrink-0 text-[11px] text-text-dim">{f.label}</span>
                    <span className="flex-1 truncate rounded-sm border border-border bg-bg-deep px-2.5 py-1.5 text-xs text-text-muted">
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>

              {openTask.notes && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Notas</div>
                  <div className="rounded-md border border-border bg-bg-deep p-2.5 text-xs leading-relaxed text-text-muted">
                    {openTask.notes}
                  </div>
                </div>
              )}

              <div className="mt-1 flex items-center gap-2">
                <form action={toggleTaskStatus} className="flex-1">
                  <input type="hidden" name="id" value={openTask.id} />
                  <input
                    type="hidden"
                    name="nextStatus"
                    value={openTask.status === "completada" ? "pendiente" : "completada"}
                  />
                  <button type="submit" className="btn-primary w-full">
                    {openTask.status === "completada" ? "Marcar pendiente" : "Completar"}
                  </button>
                </form>
                <a href={`/dashboard/agenda?pre=${openTask.id}`} className="btn-secondary">
                  Agendar
                </a>
                <form action={archiveTask}>
                  <input type="hidden" name="id" value={openTask.id} />
                  <button type="submit" className="btn-secondary">
                    Archivar
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
