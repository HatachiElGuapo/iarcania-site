import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema/trabajo";
import { Segmented, Table, TableHead, TableRow, EmptyState, cx } from "@/components/ui";
import { toggleTaskStatus } from "../../actividades/actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";

const RANGES: { id: string; label: string; days: number }[] = [
  { id: "hoy", label: "Hoy", days: 0 },
  { id: "sem", label: "Semana", days: 7 },
  { id: "2sem", label: "2 semanas", days: 14 },
  { id: "mes", label: "Mes", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
];

const COLS = "28px minmax(0,1fr) 120px 96px 72px";

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
    <div className="flex flex-col gap-4">
      <Segmented
        options={RANGES.map((r) => ({
          label: r.label,
          href: `/dashboard/trabajo/tareas?rango=${r.id}`,
          active: range.id === r.id,
        }))}
      />

      {rows.length === 0 ? (
        <EmptyState icon="✅">No tienes tareas con vencimiento en este rango.</EmptyState>
      ) : (
        <Table>
          <TableHead cols={COLS}>
            <span />
            <span>Tarea</span>
            <span>Categoría</span>
            <span>Vence</span>
            <span>Hora</span>
          </TableHead>
          {rows.map((task) => {
            const done = task.status === "completada";
            return (
              <TableRow key={task.id} cols={COLS} category={task.category}>
                <form action={toggleTaskStatus} className="flex">
                  <input type="hidden" name="id" value={task.id} />
                  <input
                    type="hidden"
                    name="nextStatus"
                    value={done ? "pendiente" : "completada"}
                  />
                  <button
                    type="submit"
                    className={cx(
                      "focus-ring h-4 w-4 rounded-ui-sm border transition-colors duration-120",
                      done ? "border-accent bg-accent" : "border-line-strong hover:border-ink-dim",
                    )}
                    aria-label="Cambiar estado"
                  />
                </form>
                <span className={cx("truncate", done ? "text-ink-dim line-through" : "text-ink")}>
                  {task.title}
                </span>
                <span className="truncate text-ink-muted">{task.category ?? "—"}</span>
                <span className="tabular-nums text-ink-muted">{task.dueDate ?? "—"}</span>
                <span className="tabular-nums text-ink-muted">{task.timeDue ?? "—"}</span>
              </TableRow>
            );
          })}
        </Table>
      )}
    </div>
  );
}
