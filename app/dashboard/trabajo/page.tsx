import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks, dailyFocus, workNotes } from "@/lib/db/schema/trabajo";
import { Field } from "@/components/ui/field";
import {
  addToWorkFocus,
  toggleFocusComplete,
  removeFromFocus,
  createWorkNote,
} from "./actions";
import { createTask } from "../actividades/actions";
import { todayISO } from "@/lib/date/bogota";

const CHANNELS = [
  { id: "iarcania", label: "IArcanIA" },
  { id: "voidstoic", label: "Void Stoic" },
] as const;

export default async function TrabajoHoyPage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();
  const { canal } = await searchParams;
  const channel = canal === "voidstoic" ? "voidstoic" : "iarcania";

  const [focusItems, pendingTasks, notes] = await Promise.all([
    db
      .select({
        id: dailyFocus.id,
        completed: dailyFocus.completed,
        taskId: tasks.id,
        title: tasks.title,
        status: tasks.status,
      })
      .from(dailyFocus)
      .innerJoin(tasks, eq(dailyFocus.taskId, tasks.id))
      .where(
        and(
          eq(dailyFocus.userId, userId),
          eq(dailyFocus.date, date),
          eq(dailyFocus.listType, "trabajo"),
        ),
      )
      .orderBy(asc(dailyFocus.sortOrder), asc(dailyFocus.createdAt)),
    db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "pendiente"),
          notInArray(
            tasks.id,
            db
              .select({ id: dailyFocus.taskId })
              .from(dailyFocus)
              .where(
                and(
                  eq(dailyFocus.userId, userId),
                  eq(dailyFocus.date, date),
                  eq(dailyFocus.listType, "trabajo"),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(tasks.createdAt)),
    db
      .select()
      .from(workNotes)
      .where(and(eq(workNotes.userId, userId), eq(workNotes.channel, channel)))
      .orderBy(desc(workNotes.createdAt))
      .limit(3),
  ]);

  const doneCount = focusItems.filter((i) => i.completed).length;

  return (
    <div className="space-y-10">
      {/* Foco de hoy */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Hoy en trabajo · {doneCount}/{focusItems.length}
        </h2>

        {focusItems.length === 0 ? (
          <p className="mb-3 text-sm text-text-muted">
            Todavía no agregaste nada al foco de hoy.
          </p>
        ) : (
          <div className="mb-3 space-y-2">
            {focusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2"
              >
                <form action={toggleFocusComplete}>
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="nextCompleted"
                    value={String(!item.completed)}
                  />
                  <button
                    type="submit"
                    className={`h-4 w-4 rounded border ${item.completed ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                    aria-label="Marcar completada"
                  />
                </form>
                <span
                  className={`flex-1 text-sm ${item.completed ? "text-text-dim line-through" : "text-text-primary"}`}
                >
                  {item.title}
                </span>
                <form action={removeFromFocus}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="text-xs text-text-muted hover:text-red-400"
                  >
                    Quitar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {pendingTasks.length > 0 && (
          <form
            action={addToWorkFocus}
            className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
          >
            <input type="hidden" name="date" value={date} />
            <Field label="Agregar tarea existente">
              <select name="taskId" required className="input">
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              + Agregar a hoy
            </button>
          </form>
        )}

        <form
          action={createTask}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <Field label="Nueva tarea">
            <input type="text" name="title" required className="input" />
          </Field>
          <Field label="Vence">
            <input type="date" name="dueDate" className="input" />
          </Field>
          <Field label="Categoría">
            <input type="text" name="category" className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            + Crear tarea
          </button>
        </form>
      </section>

      {/* Notas de trabajo */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">
            Notas
          </h2>
          <div className="ml-auto flex gap-1">
            {CHANNELS.map((c) => (
              <a
                key={c.id}
                href={`/dashboard/trabajo?canal=${c.id}`}
                className={`rounded-sm px-2 py-1 text-xs ${
                  channel === c.id
                    ? "bg-bg-card text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="mb-3 text-sm text-text-muted">
            Sin notas todavía para este canal.
          </p>
        ) : (
          <div className="mb-3 space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-md border border-border bg-bg-card px-4 py-2 text-sm text-text-primary"
              >
                {note.content}
                <div className="mt-1 text-xs text-text-muted">
                  {note.date}
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          action={createWorkNote}
          className="flex items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="date" value={date} />
          <Field label="Nueva nota">
            <input type="text" name="content" required className="input w-80" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            + Agregar
          </button>
        </form>
      </section>
    </div>
  );
}
