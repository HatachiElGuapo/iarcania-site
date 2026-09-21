import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { loadPlanContext, toPlanData } from "@/lib/plan/load";
import { resolvePlan, computeQueueProgress } from "@/lib/plan/resolve";
import { todayISO, diffDaysISO } from "@/lib/date/bogota";
import { PageHeader, Card, Input, Textarea, Labeled, Button, Progress, EmptyState } from "@/components/ui";
import { updatePhase, replaceQueueItems } from "./actions";

export default async function PlanFasesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContext(userId);
  if (!ctx) {
    return (
      <div className="p-8">
        <PageHeader icon="🗺️" title="Plan · Fases" />
        <EmptyState icon="🗺️">Todavía no hay ningún plan importado.</EmptyState>
      </div>
    );
  }

  const globalQueues = ctx.queues.filter((q) => q.global);
  const phaseQueues = ctx.queues.filter((q) => !q.global);
  const itemsFor = (queueId: string, phaseId: string | null) =>
    ctx.queueItems
      .filter((i) => i.queueId === queueId && i.phaseId === phaseId)
      .sort((a, b) => a.position - b.position)
      .map((i) => i.text)
      .join("\n");
  const itemCountFor = (queueId: string, phaseId: string | null) =>
    ctx.queueItems.filter((i) => i.queueId === queueId && i.phaseId === phaseId).length;

  // Progreso: días transcurridos, % de bloques hechos/saltados, y posición
  // en cada cola — todo hasta hoy (o hasta que termine la fase, si ya
  // terminó). Si el plan todavía no arrancó, no hay nada que resolver.
  const today = todayISO();
  const planData = toPlanData(ctx);
  const planStarted = today >= planData.startDate;
  const resolvedSoFar = planStarted ? resolvePlan(planData, planData.startDate, today) : [];
  const queueProgress = planStarted ? computeQueueProgress(planData, today) : new Map<string, number>();

  const allChecks = await db.select().from(planChecks).where(eq(planChecks.planId, ctx.plan.id));
  const checkByKey = new Map(allChecks.map((c) => [`${c.date}:${c.blockId}`, c.status]));

  const phaseStats = ctx.phases.map((phase) => {
    const totalDays = diffDaysISO(phase.startDate, phase.endDate) + 1;
    const notStartedYet = today < phase.startDate;
    const elapsedDays = notStartedYet ? 0 : Math.min(totalDays, diffDaysISO(phase.startDate, today) + 1);

    let totalBlocks = 0;
    let doneBlocks = 0;
    let skippedBlocks = 0;
    for (const day of resolvedSoFar) {
      if (day.date < phase.startDate || day.date > phase.endDate) continue;
      for (const list of Object.values(day.blocksByPerson)) {
        for (const b of list) {
          totalBlocks++;
          const status = checkByKey.get(`${day.date}:${b.blockId}`);
          if (status === "done") doneBlocks++;
          else if (status === "skipped") skippedBlocks++;
        }
      }
    }
    const donePct = totalBlocks ? Math.round((doneBlocks / totalBlocks) * 100) : 0;

    return { phase, totalDays, elapsedDays, notStartedYet, totalBlocks, doneBlocks, skippedBlocks, donePct };
  });

  return (
    <div className="p-8">
      <PageHeader
        icon="🗺️"
        title="Plan · Fases"
        subtitle="Una tarea por línea. Al guardar se reescribe toda la lista de esa cola, en ese orden."
      />

      {globalQueues.length > 0 && (
        <Card title="Colas globales" className="mb-5">
          <p className="mb-2.5 text-meta text-ink-dim">
            No se reinician por fase — la posición sigue avanzando de una fase a la siguiente.
          </p>
          <div className="flex flex-col gap-3">
            {globalQueues.map((q) => {
              const total = itemCountFor(q.id, null);
              const done = queueProgress.get(q.id) ?? 0;
              return (
                <form key={q.id} action={replaceQueueItems} className="flex flex-col gap-1.5">
                  <input type="hidden" name="queueId" value={q.id} />
                  <Labeled label={`${q.name}${q.fallback ? ` (fallback: ${q.fallback})` : ""}`}>
                    <Textarea name="lines" defaultValue={itemsFor(q.id, null)} className="min-h-[120px] w-full" />
                  </Labeled>
                  {total > 0 && (
                    <Progress
                      pct={Math.min(100, Math.round((done / total) * 100))}
                      value={done > total ? `${done}/${total} (repitió)` : `${done}/${total}`}
                      tone="warm"
                    />
                  )}
                  <div>
                    <Button type="submit" variant="secondary" size="sm">
                      Guardar lista
                    </Button>
                  </div>
                </form>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {phaseStats.map(({ phase, totalDays, elapsedDays, notStartedYet, totalBlocks, doneBlocks, skippedBlocks, donePct }) => (
          <Card key={phase.id} title={phase.name}>
            <div className="mb-4 grid gap-3 border-b border-line pb-4 sm:grid-cols-3">
              <div>
                <div className="mb-1 flex justify-between text-meta text-ink-dim">
                  <span>Días</span>
                  <span className="text-ink-muted">
                    {elapsedDays} / {totalDays}
                  </span>
                </div>
                <Progress pct={totalDays ? (elapsedDays / totalDays) * 100 : 0} tone="primary" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-meta text-ink-dim">
                  <span>Bloques hechos</span>
                  <span className="text-ink-muted">
                    {doneBlocks} / {totalBlocks}
                  </span>
                </div>
                <Progress pct={donePct} tone="success" />
              </div>
              <div className="text-meta text-ink-dim">
                {notStartedYet ? (
                  <span>Todavía no empieza — arranca el {phase.startDate}.</span>
                ) : (
                  <span>
                    {skippedBlocks} saltado{skippedBlocks !== 1 ? "s" : ""} hasta hoy
                    {phase.goal ? ` · Meta: ${phase.goal}` : ""}
                  </span>
                )}
              </div>
            </div>

            <form action={updatePhase} className="mb-4 flex flex-wrap items-end gap-2.5 border-b border-line pb-4">
              <input type="hidden" name="id" value={phase.id} />
              <Labeled label="Nombre">
                <Input name="name" defaultValue={phase.name} className="w-56" required />
              </Labeled>
              <Labeled label="Inicio">
                <Input type="date" name="startDate" defaultValue={phase.startDate} className="w-40" required />
              </Labeled>
              <Labeled label="Fin">
                <Input type="date" name="endDate" defaultValue={phase.endDate} className="w-40" required />
              </Labeled>
              <Labeled label="Meta" className="min-w-[220px] flex-1">
                <Input name="goal" defaultValue={phase.goal ?? ""} className="w-full" />
              </Labeled>
              <Button type="submit" variant="secondary" size="sm">
                Guardar
              </Button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              {phaseQueues.map((q) => {
                const total = itemCountFor(q.id, phase.id);
                const done = queueProgress.get(`${phase.id}:${q.id}`) ?? 0;
                return (
                  <form key={q.id} action={replaceQueueItems} className="flex flex-col gap-1.5">
                    <input type="hidden" name="queueId" value={q.id} />
                    <input type="hidden" name="phaseId" value={phase.id} />
                    <Labeled label={q.name}>
                      <Textarea name="lines" defaultValue={itemsFor(q.id, phase.id)} className="min-h-[140px] w-full" />
                    </Labeled>
                    {total > 0 && (
                      <Progress
                        pct={Math.min(100, Math.round((done / total) * 100))}
                        value={done > total ? `${done}/${total} (repitió)` : `${done}/${total}`}
                        tone="warm"
                      />
                    )}
                    <div>
                      <Button type="submit" variant="secondary" size="sm">
                        Guardar lista
                      </Button>
                    </div>
                  </form>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
