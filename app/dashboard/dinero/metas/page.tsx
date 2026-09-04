import { and, asc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { purchaseGoals } from "@/lib/db/schema/metas";
import { Section, Badge, EmptyState, Labeled, Input, Select, Button, cx } from "@/components/ui";
import { createGoal, toggleGoalDone, deleteGoal } from "./actions";

const PRIORITY: Record<string, { label: string; tone: "danger" | "warm" | "neutral" }> = {
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warm" },
  baja: { label: "Baja", tone: "neutral" },
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
    <div className="flex flex-col gap-8">
      <Section title="Pendientes">
        {pending.length === 0 ? (
          <EmptyState icon="🎯">
            Tu lista de deseos priorizada: lo que quieres comprar cuando haya con qué. Todavía no
            has anotado nada — agrega la primera meta abajo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pending.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </Section>

      <form
        action={createGoal}
        className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
      >
        <Labeled label="Nombre">
          <Input name="name" required className="w-48" />
        </Labeled>
        <Labeled label="Precio">
          <Input type="number" step="0.01" name="price" required className="w-32" />
        </Labeled>
        <Labeled label="Prioridad">
          <Select name="priority" defaultValue="media">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </Select>
        </Labeled>
        <Labeled label="Fecha estimada (opcional)">
          <Input type="date" name="targetDate" className="w-40" />
        </Labeled>
        <Button type="submit" variant="secondary">
          + Nueva meta
        </Button>
      </form>

      {done.length > 0 && (
        <Section title="Compradas">
          <div className="flex flex-col gap-1.5">
            {done.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: typeof purchaseGoals.$inferSelect }) {
  const p = PRIORITY[goal.priority] ?? PRIORITY.media;
  return (
    <div className="flex items-center gap-3 rounded-ui border border-line bg-surface px-3.5 py-2">
      <form action={toggleGoalDone}>
        <input type="hidden" name="id" value={goal.id} />
        <input type="hidden" name="nextDone" value={String(!goal.done)} />
        <button
          type="submit"
          aria-label="Marcar comprada"
          className={cx(
            "flex h-4 w-4 items-center justify-center rounded border text-[9px] text-white",
            goal.done ? "border-accent bg-accent" : "border-line-strong",
          )}
        >
          {goal.done ? "✓" : ""}
        </button>
      </form>

      <span className="min-w-0 flex-1">
        <span className={cx("text-body", goal.done ? "text-ink-dim line-through" : "text-ink")}>
          {goal.name}
        </span>
        <span className="ml-2 text-meta tabular-nums text-ink-dim">
          ${goal.price.toLocaleString("es-CO")}
          {goal.targetDate ? ` · ${goal.targetDate}` : ""}
        </span>
      </span>

      <Badge tone={p.tone}>{p.label}</Badge>

      <form action={deleteGoal}>
        <input type="hidden" name="id" value={goal.id} />
        <button type="submit" className="text-meta text-ink-dim hover:text-danger">
          Eliminar
        </button>
      </form>
    </div>
  );
}
