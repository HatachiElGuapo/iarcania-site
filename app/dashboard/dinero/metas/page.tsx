import { and, asc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { purchaseGoals } from "@/lib/db/schema/metas";
import { Field } from "@/components/ui/field";
import { createGoal, toggleGoalDone, deleteGoal } from "./actions";

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "text-red-400" },
  media: { label: "Media", color: "text-gold" },
  baja: { label: "Baja", color: "text-text-muted" },
};

export default async function MetasPage() {
  const session = await auth();
  const userId = session!.user.id;

  const priorityRank = sql`CASE ${purchaseGoals.priority} WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END`;

  const [pending, done] = await Promise.all([
    db
      .select()
      .from(purchaseGoals)
      .where(and(eq(purchaseGoals.userId, userId), eq(purchaseGoals.done, false)))
      .orderBy(priorityRank, asc(purchaseGoals.targetDate)),
    db
      .select()
      .from(purchaseGoals)
      .where(and(eq(purchaseGoals.userId, userId), eq(purchaseGoals.done, true)))
      .orderBy(asc(purchaseGoals.name)),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Pendientes
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">
            Sin metas de compra pendientes.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </section>

      <form
        action={createGoal}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Nombre">
          <input type="text" name="name" required className="input" />
        </Field>
        <Field label="Precio">
          <input type="number" step="0.01" name="price" required className="input" />
        </Field>
        <Field label="Prioridad">
          <select name="priority" defaultValue="media" className="input">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </Field>
        <Field label="Fecha estimada (opcional)">
          <input type="date" name="targetDate" className="input" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nueva meta
        </button>
      </form>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
            Compradas
          </h2>
          <div className="space-y-2">
            {done.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalRow({
  goal,
}: {
  goal: typeof purchaseGoals.$inferSelect;
}) {
  const priority = PRIORITY_LABEL[goal.priority] ?? PRIORITY_LABEL.media;
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2">
      <form action={toggleGoalDone}>
        <input type="hidden" name="id" value={goal.id} />
        <input type="hidden" name="nextDone" value={String(!goal.done)} />
        <button
          type="submit"
          className={`h-4 w-4 rounded border ${goal.done ? "border-purple-mid bg-purple-mid" : "border-border"}`}
          aria-label="Marcar comprada"
        />
      </form>

      <div className="flex-1">
        <span
          className={`text-sm ${goal.done ? "text-text-dim line-through" : "text-text-primary"}`}
        >
          {goal.name}
        </span>
        <span className="ml-2 text-xs text-text-muted">
          ${goal.price.toLocaleString("es-CO")}
          {goal.targetDate ? ` · ${goal.targetDate}` : ""}
        </span>
      </div>

      <span className={`text-xs font-semibold ${priority.color}`}>
        {priority.label}
      </span>

      <form action={deleteGoal}>
        <input type="hidden" name="id" value={goal.id} />
        <button type="submit" className="text-xs text-text-muted hover:text-red-400">
          Eliminar
        </button>
      </form>
    </div>
  );
}
