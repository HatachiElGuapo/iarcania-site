import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { toggleTaskStatus } from "../../actividades/actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";

const RANGES: { id: string; label: string; days: number }[] = [
  { id: "hoy", label: "Hoy", days: 0 },
  { id: "sem", label: "Semana", days: 7 },
  { id: "2sem", label: "2 semanas", days: 14 },
  { id: "mes", label: "Mes", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
];

export default async function TrabajoTareasPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { rango } = await searchParams;
  const range = RANGES.find((r) => r.id === rango) ?? RANGES[1];

  const from = todayISO();
  const until = addDaysISO(from, range.days);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        ne(tasks.status, "archivada"),
        gte(tasks.dueDate, from),
        lte(tasks.dueDate, until),
      ),
    )
    .orderBy(asc(tasks.status), asc(tasks.dueDate), asc(tasks.timeDue));

  return (
    <div>
      <div className="mb-4 flex gap-2 text-sm">
        {RANGES.map((r) => (
          <a
            key={r.id}
            href={`/dashboard/trabajo/tareas?rango=${r.id}`}
            className={`rounded-sm px-2 py-1 ${
              range.id === r.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {r.label}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          No hay tareas con vencimiento en este rango.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium">Tarea</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Vence</th>
                <th className="px-3 py-2 font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <form action={toggleTaskStatus}>
                      <input type="hidden" name="id" value={task.id} />
                      <input
                        type="hidden"
                        name="nextStatus"
                        value={
                          task.status === "completada"
                            ? "pendiente"
                            : "completada"
                        }
                      />
                      <button
                        type="submit"
                        className={`h-4 w-4 rounded border ${task.status === "completada" ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                        aria-label="Cambiar estado"
                      />
                    </form>
                  </td>
                  <td
                    className={`px-3 py-2 ${task.status === "completada" ? "text-text-dim line-through" : "text-text-primary"}`}
                  >
                    {task.title}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {task.category ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {task.dueDate ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {task.timeDue ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
