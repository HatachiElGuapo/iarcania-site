import { and, asc, eq, ne, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";
import { tasks } from "@/lib/db/schema/trabajo";
import { appointments } from "@/lib/db/schema/citas";
import { Field } from "@/components/ui/field";
import { createBlock, updateBlock, deleteBlock } from "./actions";
import { todayISO, addDaysISO as addDays } from "@/lib/date/bogota";

type Block = InferSelectModel<typeof agendaItems>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();

  const [blocks, pendingTasks, citas] = await Promise.all([
    db
      .select()
      .from(agendaItems)
      .where(and(eq(agendaItems.userId, userId), eq(agendaItems.date, date)))
      .orderBy(asc(agendaItems.blockTime)),
    db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada")))
      .orderBy(asc(tasks.title)),
    db
      .select({ id: appointments.id, title: appointments.title })
      .from(appointments)
      .where(eq(appointments.userId, userId)),
  ]);

  const taskTitleById = new Map(pendingTasks.map((t) => [t.id, t.title]));
  const citaTitleById = new Map(citas.map((c) => [c.id, c.title]));

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Agenda</h1>

      <div className="flex items-center gap-2 text-sm">
        <a
          href={`/dashboard/agenda?date=${addDays(date, -1)}`}
          className="rounded-sm border border-border px-3 py-1.5 text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          ← Anterior
        </a>
        <a
          href={`/dashboard/agenda?date=${todayISO()}`}
          className={`rounded-sm px-3 py-1.5 ${
            date === todayISO()
              ? "bg-bg-card text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Hoy
        </a>
        <a
          href={`/dashboard/agenda?date=${addDays(date, 1)}`}
          className="rounded-sm border border-border px-3 py-1.5 text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          Siguiente →
        </a>
        <span className="ml-2 text-text-primary">{date}</span>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-text-muted">Sin bloques agendados este día.</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <BlockRow
              key={b.id}
              block={b}
              taskTitle={
                b.itemId
                  ? (b.itemType === "cita" ? citaTitleById : taskTitleById).get(b.itemId)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <form
        action={createBlock}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <input type="hidden" name="date" value={date} />
        <Field label="Hora">
          <input type="time" name="blockTime" step={600} required className="input" />
        </Field>
        <Field label="Duración (min)">
          <input type="number" name="duration" defaultValue={20} min={10} step={10} className="input" />
        </Field>
        <Field label="Tipo">
          <select name="itemType" defaultValue="nota" className="input">
            <option value="nota">Nota libre</option>
            <option value="task">Tarea vinculada</option>
          </select>
        </Field>
        <Field label="Tarea (si aplica)">
          <select name="itemId" defaultValue="" className="input">
            <option value="">—</option>
            {pendingTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notas">
          <input type="text" name="notes" className="input w-48" />
        </Field>
        <button
          type="submit"
          className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          + Agregar bloque
        </button>
      </form>
    </div>
  );
}

function BlockRow({ block, taskTitle }: { block: Block; taskTitle?: string }) {
  const label = taskTitle ?? block.notes ?? "(sin título)";
  const icon = block.itemType === "task" ? "✅" : block.itemType === "cita" ? "📞" : "📝";

  return (
    <div className="rounded-md border border-border bg-bg-card p-3">
      <div className="flex items-center gap-3">
        <span className="w-14 text-sm font-semibold text-text-primary">
          {block.blockTime}
        </span>
        <span>{icon}</span>
        <span className="flex-1 text-sm text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">{block.duration} min</span>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-text-muted">Editar</summary>
        <form
          action={updateBlock}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="id" value={block.id} />
          <Field label="Hora">
            <input
              type="time"
              name="blockTime"
              step={600}
              defaultValue={block.blockTime}
              required
              className="input"
            />
          </Field>
          <Field label="Duración (min)">
            <input
              type="number"
              name="duration"
              defaultValue={block.duration}
              min={10}
              step={10}
              className="input"
            />
          </Field>
          <Field label="Notas">
            <input
              type="text"
              name="notes"
              defaultValue={block.notes ?? ""}
              className="input w-48"
            />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar
          </button>
          <button
            type="submit"
            formAction={deleteBlock}
            className="rounded-sm border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-400"
          >
            Eliminar
          </button>
        </form>
      </details>
    </div>
  );
}
