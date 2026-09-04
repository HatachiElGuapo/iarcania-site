import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { tasks, dailyFocus, workNotes } from "@/lib/db/schema/trabajo";
import { Section, Segmented, Labeled, Input, Select, Button, EmptyState, cx } from "@/components/ui";
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
    <div className="flex flex-col gap-8">
      <Section title={`Hoy en trabajo · ${doneCount}/${focusItems.length}`}>
        {focusItems.length === 0 ? (
          <EmptyState icon="🎯">
            Todavía no has agregado nada al foco de hoy. Trae una tarea pendiente o crea una nueva
            abajo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {focusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-ui-lg border border-line bg-surface px-4 py-2"
              >
                <form action={toggleFocusComplete} className="flex">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="nextCompleted" value={String(!item.completed)} />
                  <button
                    type="submit"
                    className={cx(
                      "focus-ring h-4 w-4 rounded-ui-sm border transition-colors duration-120",
                      item.completed ? "border-accent bg-accent" : "border-line-strong hover:border-ink-dim",
                    )}
                    aria-label="Marcar completada"
                  />
                </form>
                <span
                  className={cx(
                    "flex-1 text-body",
                    item.completed ? "text-ink-dim line-through" : "text-ink",
                  )}
                >
                  {item.title}
                </span>
                <form action={removeFromFocus}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="focus-ring text-meta text-ink-muted transition-colors duration-120 hover:text-danger"
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
            className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
          >
            <input type="hidden" name="date" value={date} />
            <Labeled label="Agregar tarea existente">
              <Select name="taskId" required className="w-64">
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Labeled>
            <Button type="submit" variant="secondary">
              + Agregar a hoy
            </Button>
          </form>
        )}

        <form
          action={createTask}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
        >
          <Labeled label="Nueva tarea">
            <Input name="title" required className="w-64" />
          </Labeled>
          <Labeled label="Vence">
            <Input type="date" name="dueDate" className="w-40" />
          </Labeled>
          <Labeled label="Categoría">
            <Input name="category" className="w-40" />
          </Labeled>
          <Button type="submit" variant="secondary">
            + Crear tarea
          </Button>
        </form>
      </Section>

      <Section
        title="Notas"
        action={
          <Segmented
            className="border-0"
            options={CHANNELS.map((c) => ({
              label: c.label,
              href: `/dashboard/trabajo?canal=${c.id}`,
              active: channel === c.id,
            }))}
          />
        }
      >
        {notes.length === 0 ? (
          <EmptyState icon="🗒️">Aún no has escrito notas en este canal.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-ui-lg border border-line bg-surface px-4 py-2 text-body text-ink"
              >
                {note.content}
                <div className="mt-1 text-meta tabular-nums text-ink-dim">{note.date}</div>
              </div>
            ))}
          </div>
        )}

        <form
          action={createWorkNote}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
        >
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="date" value={date} />
          <Labeled label="Nueva nota">
            <Input name="content" required className="w-80" />
          </Labeled>
          <Button type="submit" variant="secondary">
            + Agregar
          </Button>
        </form>
      </Section>
    </div>
  );
}
