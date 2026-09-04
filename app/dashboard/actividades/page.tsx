import { and, asc, eq, gte, lte, lt, ne, type InferSelectModel, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { CATS } from "@/lib/constants/cats";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import {
  PageHeader,
  Button,
  Card,
  Table,
  TableHead,
  TableRow,
  Badge,
  CategoryDot,
  EmptyState,
  NoResults,
  QuickCapture,
  Select,
  Input,
  catInfo,
  cx,
} from "@/components/ui";
import {
  createTask,
  toggleTaskStatus,
  archiveTask,
  unarchiveTask,
  deleteTask,
} from "./actions";

type Task = InferSelectModel<typeof tasks>;

// Arquetipo 1 · variante 2a — tabla densa AGRUPADA por vencimiento, sin
// panel de detalle. Tabs de tiempo + leyenda de categorías filtran; la
// agrupación reparte lo que quede en Vencidas / Hoy / Semana / Más adelante
// / Sin fecha. Reutiliza las Server Actions de ./actions tal cual.
const TIEMPO_TABS: { id: string; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "vencidas", label: "Vencidas" },
  { id: "completadas", label: "Completadas" },
];

const PRIORITY_TONE = { alta: "danger", media: "warm", baja: "neutral" } as const;

const COLS = "20px minmax(0,1fr) 128px 82px 96px 148px";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortDate(iso: string, year: string) {
  return iso.replace(`${year}-`, "");
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
  } else {
    conditions.push(ne(tasks.status, "completada"));
  }
  return conditions;
}

type BucketKey = "vencidas" | "hoy" | "semana" | "adelante" | "sinfecha" | "completadas";
const BUCKET_META: Record<BucketKey, { label: string; color: string }> = {
  vencidas: { label: "Vencidas", color: "#F87171" }, // danger
  hoy: { label: "Hoy", color: "#E8A33D" }, // accent-warm
  semana: { label: "Esta semana", color: "#9896B0" }, // ink-muted
  adelante: { label: "Más adelante", color: "#5A5870" }, // ink-dim
  sinfecha: { label: "Sin fecha", color: "#5A5870" },
  completadas: { label: "Completadas", color: "#4ADE80" }, // success
};
const BUCKET_ORDER: BucketKey[] = ["vencidas", "hoy", "semana", "adelante", "sinfecha"];

export default async function ActividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tiempo?: string; cat?: string; archivadas?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tiempo: tiempoParam, cat, archivadas } = await searchParams;
  const tiempo = TIEMPO_TABS.find((t) => t.id === tiempoParam)?.id ?? "todas";
  const showArchived = archivadas === "1";
  const today = todayISO();
  const year = today.slice(0, 4);
  const weekEnd = addDaysISO(today, 7);
  const monthStart = today.slice(0, 8) + "01";

  if (showArchived) {
    const archivedRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "archivada")))
      .orderBy(asc(tasks.dueDate));

    return (
      <div className="p-8">
        <PageHeader
          icon="✅"
          title="Archivadas"
          subtitle={`${archivedRows.length} tarea${archivedRows.length !== 1 ? "s" : ""} archivada${archivedRows.length !== 1 ? "s" : ""}`}
          actions={
            <Button variant="secondary" href="/dashboard/actividades">
              ← Ver activas
            </Button>
          }
        />
        {archivedRows.length === 0 ? (
          <EmptyState icon="🗄️">
            No has archivado ninguna tarea. Cuando archives una, aparecerá aquí.
          </EmptyState>
        ) : (
          <Card flush>
            <div className="divide-y divide-line">
              {archivedRows.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-dim">{task.title}</span>
                  {task.category && (
                    <span className="text-[10px]" style={{ color: catInfo(task.category).color }}>
                      {catInfo(task.category).label}
                    </span>
                  )}
                  <form action={unarchiveTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                      Restaurar
                    </button>
                  </form>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="text-xs text-ink-muted hover:text-danger">
                      Eliminar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
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
      .select({ category: tasks.category })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada"), ne(tasks.status, "completada"))),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "completada"), gte(tasks.dueDate, monthStart))),
  ]);

  const archivedCount = archivedIds.length;
  const tabCounts = Object.fromEntries(tabCountsRaw) as Record<string, number>;
  const completedThisMonth = completedMonthIds.length;

  const catCounts: Record<string, number> = {};
  for (const r of breakdownRows) if (r.category) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1;

  function bucketOf(t: Task): BucketKey {
    if (tiempo === "completadas" || t.status === "completada") return "completadas";
    if (!t.dueDate) return "sinfecha";
    if (t.dueDate < today) return "vencidas";
    if (t.dueDate === today) return "hoy";
    if (t.dueDate <= weekEnd) return "semana";
    return "adelante";
  }

  const grouped = new Map<BucketKey, Task[]>();
  for (const t of rows) {
    const k = bucketOf(t);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(t);
  }
  const orderedBuckets = (tiempo === "completadas" ? (["completadas"] as BucketKey[]) : BUCKET_ORDER).filter(
    (k) => grouped.get(k)?.length,
  );

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

  function rowMeta(t: Task): string {
    if (t.timeDue) return t.timeDue + (t.timeEnd ? ` – ${t.timeEnd}` : "");
    if (t.dueDate && t.dueDate < today && t.status !== "completada") {
      const days = Math.round((Date.parse(today) - Date.parse(t.dueDate)) / 86400000);
      return `vence hace ${days} día${days !== 1 ? "s" : ""}`;
    }
    return "";
  }

  return (
    <div className="p-8">
      <PageHeader
        icon="✅"
        title="Actividades"
        subtitle={`${tabCounts["todas"] ?? 0} activas · ${tabCounts["vencidas"] ?? 0} vencidas · ${completedThisMonth} completadas este mes`}
        actions={
          <>
            <Button variant="secondary" href={qs({ archivadas: "1" })}>
              Ver archivadas ({archivedCount})
            </Button>
            <Button href="#nueva-tarea">+ Nueva tarea</Button>
          </>
        }
      />

      {/* Tabs de tiempo */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3.5">
        {TIEMPO_TABS.map((t) => {
          const active = tiempo === t.id;
          return (
            <a
              key={t.id}
              href={qs({ tiempo: t.id === "todas" ? undefined : t.id })}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-ui border px-3 py-1.5 text-xs transition-colors duration-120",
                active
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              <span className={active ? "text-accent-warm" : "text-ink-dim"}>{tabCounts[t.id] ?? 0}</span>
            </a>
          );
        })}
      </div>

      {/* Leyenda de categorías (filtro) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Object.keys(CATS).map((key) => {
          const c = catInfo(key);
          const active = cat === key;
          return (
            <a
              key={key}
              href={qs({ cat: active ? undefined : key })}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-meta transition-colors duration-120"
              style={{
                borderColor: active ? c.color : `${c.color}2e`,
                background: active ? `${c.color}24` : `${c.color}12`,
                color: c.color,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: c.color }} />
              {c.label}
              <span className="text-ink-dim">{catCounts[key] ?? 0}</span>
            </a>
          );
        })}
        {cat && (
          <a href={qs({ cat: undefined })} className="text-meta text-ink-dim hover:text-ink">
            limpiar
          </a>
        )}
      </div>

      {/* Grupos */}
      <div className="mt-4 flex flex-col gap-4">
        {rows.length === 0 ? (
          tiempo !== "todas" || cat ? (
            <NoResults
              context={
                <>
                  {tiempo !== "todas" ? <>en «{TIEMPO_TABS.find((t) => t.id === tiempo)?.label}»</> : null}
                  {cat ? <> · categoría «{CATS[cat]?.label}»</> : null}
                </>
              }
              clearHref="/dashboard/actividades"
            />
          ) : (
            <EmptyState icon="✅">
              Todo lo que tienes que hacer vive aquí. Todavía no has creado ninguna tarea — agrega
              la primera con la barra de abajo.
            </EmptyState>
          )
        ) : (
          orderedBuckets.map((bk) => {
            const items = grouped.get(bk)!;
            const meta = BUCKET_META[bk];
            const label = bk === "hoy" ? `Hoy · ${capitalize(new Date(`${today}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short" }))}` : meta.label;
            return (
              <div key={bk} className="flex flex-col">
                <div className="flex items-center gap-2 px-0.5 pb-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: meta.color }}
                  >
                    {label}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[10px] text-ink-dim">
                    {items.length} tarea{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Table>
                  <TableHead cols={COLS}>
                    <span />
                    <span>Tarea</span>
                    <span>Categoría</span>
                    <span>Prioridad</span>
                    <span>Vence</span>
                    <span className="text-right">Acciones</span>
                  </TableHead>
                  {items.map((t) => {
                    const isOverdue = !!t.dueDate && t.dueDate < today && t.status !== "completada";
                    const isDone = t.status === "completada";
                    const c = t.category ? catInfo(t.category) : null;
                    const m = rowMeta(t);
                    return (
                      <TableRow
                        key={t.id}
                        cols={COLS}
                        category={t.category}
                        accentColor={isOverdue ? "#F87171" : isDone ? "#262629" : undefined}
                      >
                        <form action={toggleTaskStatus}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="nextStatus" value={isDone ? "pendiente" : "completada"} />
                          <button
                            type="submit"
                            aria-label="Cambiar estado"
                            className={cx(
                              "flex h-4 w-4 items-center justify-center rounded-[4px] border text-[9px] text-white",
                              isDone ? "border-accent bg-accent" : "border-line-strong",
                            )}
                          >
                            {isDone ? "✓" : ""}
                          </button>
                        </form>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cx("min-w-0 truncate", isDone ? "text-ink-dim line-through" : "text-ink")}>
                            {t.title}
                          </span>
                          {m && <span className="shrink-0 text-[10.5px] text-ink-dim">{m}</span>}
                        </span>
                        {c ? (
                          <span className="flex items-center gap-1.5 text-meta" style={{ color: c.color }}>
                            <CategoryDot category={t.category} />
                            {c.label}
                          </span>
                        ) : (
                          <span className="text-meta text-ink-dim">—</span>
                        )}
                        <span>
                          <Badge tone={PRIORITY_TONE[t.priority as keyof typeof PRIORITY_TONE] ?? "neutral"}>
                            {t.priority}
                          </Badge>
                        </span>
                        <span className={cx("text-meta tabular-nums", isOverdue ? "text-danger" : "text-ink-dim")}>
                          {t.dueDate ? shortDate(t.dueDate, year) : "sin fecha"}
                        </span>
                        <span className="flex justify-end gap-2.5 text-meta text-ink-dim">
                          <a href={`/dashboard/agenda?pre=${t.id}`} className="hover:text-ink">
                            Agenda
                          </a>
                          <form action={archiveTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button type="submit" className="hover:text-ink">
                              Archivar
                            </button>
                          </form>
                          <form action={deleteTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button type="submit" className="hover:text-danger">
                              Eliminar
                            </button>
                          </form>
                        </span>
                      </TableRow>
                    );
                  })}
                </Table>
              </div>
            );
          })
        )}
      </div>

      {/* Quick-add fijo */}
      <div id="nueva-tarea" className="mt-4">
        <QuickCapture
          action={createTask}
          placeholder="Título de la tarea…"
          submitLabel="+ Nueva tarea"
          extras={
            <>
              <Select name="category" defaultValue={cat ?? ""} aria-label="Categoría">
                <option value="">Sin categoría</option>
                {Object.entries(CATS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select name="priority" defaultValue="media" aria-label="Prioridad">
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </Select>
              <Input type="date" name="dueDate" defaultValue={today} aria-label="Vence" />
              <Input type="time" name="timeDue" aria-label="Hora inicio" />
              <Input type="time" name="timeEnd" aria-label="Hora fin" />
            </>
          }
        />
      </div>
    </div>
  );
}
