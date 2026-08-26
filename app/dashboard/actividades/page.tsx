import { and, asc, eq, gte, lte, lt, ne, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
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

const TIEMPO_TABS: { id: string; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "vencidas", label: "Vencidas" },
  { id: "completadas", label: "Completadas" },
];

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-red-400",
  media: "text-gold",
  baja: "text-text-muted",
};

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
  const weekEnd = addDaysISO(today, 7);

  const conditions = [eq(tasks.userId, userId)];

  if (showArchived) {
    conditions.push(eq(tasks.status, "archivada"));
  } else {
    conditions.push(ne(tasks.status, "archivada"));
    if (tiempo === "completadas") conditions.push(eq(tasks.status, "completada"));
    else if (tiempo === "vencidas") {
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
    if (cat) conditions.push(eq(tasks.category, cat));
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate), asc(tasks.timeDue));

  const archivedCount = showArchived
    ? rows.length
    : (
        await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.status, "archivada")))
      ).length;

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Actividades</h1>

      {!showArchived && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {TIEMPO_TABS.map((t) => (
              <a
                key={t.id}
                href={`/dashboard/actividades?tiempo=${t.id}${cat ? `&cat=${cat}` : ""}`}
                className={`rounded-sm px-3 py-1.5 ${
                  tiempo === t.id
                    ? "bg-bg-card text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>

          <form method="GET" className="flex items-end gap-3">
            <input type="hidden" name="tiempo" value={tiempo} />
            <Field label="Categoría">
              <select name="cat" defaultValue={cat ?? ""} className="input">
                <option value="">Todas las categorías</option>
                {Object.entries(CATS).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              Filtrar
            </button>
          </form>
        </>
      )}

      <div className="flex items-center justify-between">
        <a
          href={
            showArchived
              ? "/dashboard/actividades"
              : "/dashboard/actividades?archivadas=1"
          }
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {showArchived ? "← Ver activas" : `Ver archivadas (${archivedCount})`}
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          {showArchived ? "No hay tareas archivadas." : "No hay tareas para este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium">Tarea</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Prioridad</th>
                <th className="px-3 py-2 font-medium">Vence</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const isOverdue =
                  !showArchived &&
                  task.dueDate &&
                  task.dueDate < today &&
                  task.status !== "completada";
                const cat = task.category ? CATS[task.category] : null;
                return (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {!showArchived && (
                        <form action={toggleTaskStatus}>
                          <input type="hidden" name="id" value={task.id} />
                          <input
                            type="hidden"
                            name="nextStatus"
                            value={task.status === "completada" ? "pendiente" : "completada"}
                          />
                          <button
                            type="submit"
                            className={`h-4 w-4 rounded border ${task.status === "completada" ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                            aria-label="Cambiar estado"
                          />
                        </form>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 ${task.status === "completada" ? "text-text-dim line-through" : "text-text-primary"}`}
                    >
                      {task.title}
                    </td>
                    <td className="px-3 py-2">
                      {cat ? (
                        <span style={{ color: cat.color }} className="text-xs font-semibold">
                          {cat.label}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-xs font-semibold ${PRIORITY_COLOR[task.priority] ?? ""}`}>
                      {task.priority}
                    </td>
                    <td className={`px-3 py-2 text-xs ${isOverdue ? "text-red-400" : "text-text-muted"}`}>
                      {task.dueDate ?? "—"}
                      {task.timeDue ? ` ${task.timeDue}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        {showArchived ? (
                          <form action={unarchiveTask}>
                            <input type="hidden" name="id" value={task.id} />
                            <button type="submit" className="text-text-muted hover:text-text-primary">
                              Restaurar
                            </button>
                          </form>
                        ) : (
                          <form action={archiveTask}>
                            <input type="hidden" name="id" value={task.id} />
                            <button type="submit" className="text-text-muted hover:text-text-primary">
                              Archivar
                            </button>
                          </form>
                        )}
                        <form action={deleteTask}>
                          <input type="hidden" name="id" value={task.id} />
                          <button type="submit" className="text-text-muted hover:text-red-400">
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!showArchived && (
        <form
          action={createTask}
          className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Título">
            <input type="text" name="title" required className="input" />
          </Field>
          <Field label="Categoría">
            <select name="category" defaultValue="" className="input">
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
            <input type="date" name="dueDate" className="input" />
          </Field>
          <Field label="Hora inicio">
            <input type="time" name="timeDue" className="input" />
          </Field>
          <Field label="Hora fin">
            <input type="time" name="timeEnd" className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            + Nueva tarea
          </button>
        </form>
      )}
    </div>
  );
}
