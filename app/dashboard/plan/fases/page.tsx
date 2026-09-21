import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks, planBlocks } from "@/lib/db/schema/plan";
import { loadPlanContext, toPlanData } from "@/lib/plan/load";
import { resolvePlan, computeQueueProgress } from "@/lib/plan/resolve";
import { todayISO, diffDaysISO } from "@/lib/date/bogota";
import { Card, Input, Textarea, Labeled, Button, Progress, EmptyState } from "@/components/ui";
import { updatePhase, replaceQueueItems } from "./actions";

export default async function PlanFasesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContext(userId);
  if (!ctx) {
    return <EmptyState icon="🗺️">Todavía no hay ningún plan importado.</EmptyState>;
  }

  const globalQueues = ctx.queues.filter((q) => q.global);
  const phaseQueues = ctx.queues.filter((q) => !q.global);
  const itemsOf = (queueId: string, phaseId: string | null) =>
    ctx.queueItems.filter((i) => i.queueId === queueId && i.phaseId === phaseId).sort((a, b) => a.position - b.position);
  const itemsFor = (queueId: string, phaseId: string | null) => itemsOf(queueId, phaseId).map((i) => i.text).join("\n");

  // Progreso: días transcurridos, % de bloques hechos/saltados, y posición
  // en cada cola — todo hasta hoy (o hasta que termine la fase, si ya
  // terminó). Si el plan todavía no arrancó, no hay nada que resolver.
  const today = todayISO();
  const planData = toPlanData(ctx);
  const planStarted = today >= planData.startDate;
  const resolvedSoFar = planStarted ? resolvePlan(planData, planData.startDate, today) : [];
  const queueProgress = planStarted ? computeQueueProgress(planData, today) : new Map<string, number>();

  // Un solo query de plan_checks (con join a plan_blocks para saber la cola
  // de cada uno) alcanza para las dos cosas: el % de bloques hechos por
  // fase (checkByKey) y qué tareas de cada cola ya se hicieron
  // (doneDateByQueueText) — esto último no vive en plan_queue_items (eso es
  // solo la plantilla), sino en resolved_text del check "hecho" que
  // coincide con el texto de ese item. Se guarda la fecha más reciente por
  // si se repite (cola cíclica).
  const allChecks = await db
    .select({
      date: planChecks.date,
      blockId: planChecks.blockId,
      status: planChecks.status,
      resolvedText: planChecks.resolvedText,
      queueId: planBlocks.queueId,
    })
    .from(planChecks)
    .innerJoin(planBlocks, eq(planBlocks.id, planChecks.blockId))
    .where(eq(planChecks.planId, ctx.plan.id));
  const checkByKey = new Map(allChecks.map((c) => [`${c.date}:${c.blockId}`, c.status]));

  const doneDateByQueueText = new Map<string, string>();
  for (const c of allChecks) {
    if (c.status !== "done" || !c.queueId) continue;
    const key = `${c.queueId}:${c.resolvedText}`;
    const prev = doneDateByQueueText.get(key);
    if (!prev || c.date > prev) doneDateByQueueText.set(key, c.date);
  }

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
    <>
      <p className="mb-5 text-meta text-ink-dim">
        Cada cola muestra su lista con lo que ya se hizo (según el historial de checks) — para reordenar,
        agregar o borrar de una, abrí &ldquo;Editar como texto&rdquo;.
      </p>

      {globalQueues.length > 0 && (
        <Card title="Colas globales" className="mb-5">
          <p className="mb-2.5 text-meta text-ink-dim">
            No se reinician por fase — la posición sigue avanzando de una fase a la siguiente.
          </p>
          <div className="flex flex-col gap-3">
            {globalQueues.map((q) => (
              <QueueChecklist
                key={q.id}
                queueId={q.id}
                phaseId={null}
                name={`${q.name}${q.fallback ? ` (fallback: ${q.fallback})` : ""}`}
                items={itemsOf(q.id, null)}
                itemsText={itemsFor(q.id, null)}
                doneDateByQueueText={doneDateByQueueText}
                progressDone={queueProgress.get(q.id) ?? 0}
              />
            ))}
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
              {phaseQueues.map((q) => (
                <QueueChecklist
                  key={q.id}
                  queueId={q.id}
                  phaseId={phase.id}
                  name={q.name}
                  items={itemsOf(q.id, phase.id)}
                  itemsText={itemsFor(q.id, phase.id)}
                  doneDateByQueueText={doneDateByQueueText}
                  progressDone={queueProgress.get(`${phase.id}:${q.id}`) ?? 0}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function QueueChecklist({
  queueId,
  phaseId,
  name,
  items,
  itemsText,
  doneDateByQueueText,
  progressDone,
}: {
  queueId: string;
  phaseId: string | null;
  name: string;
  items: { text: string }[];
  itemsText: string;
  doneDateByQueueText: Map<string, string>;
  progressDone: number;
}) {
  const total = items.length;
  const doneCount = items.filter((i) => doneDateByQueueText.has(`${queueId}:${i.text}`)).length;

  return (
    <div className="flex flex-col gap-1.5">
      <Labeled label={name}>
        {total === 0 ? (
          <p className="text-meta text-ink-dim">Sin tareas todavía.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-ui border border-line">
            {items.map((item, i) => {
              const doneDate = doneDateByQueueText.get(`${queueId}:${item.text}`);
              return (
                <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 text-meta">
                  <span className={`mt-0.5 shrink-0 ${doneDate ? "text-success" : "text-ink-dim"}`}>
                    {doneDate ? "✓" : "○"}
                  </span>
                  <span className={`min-w-0 flex-1 ${doneDate ? "text-ink-dim line-through" : "text-ink"}`}>
                    {item.text}
                  </span>
                  {doneDate && <span className="shrink-0 tabular-nums text-ink-dim">{doneDate}</span>}
                </div>
              );
            })}
          </div>
        )}
      </Labeled>
      {total > 0 && (
        <Progress
          label={`${doneCount} hecho${doneCount !== 1 ? "s" : ""} de ${total}`}
          pct={Math.min(100, Math.round((progressDone / total) * 100))}
          value={progressDone > total ? `pos. ${progressDone}/${total} (repitió)` : `pos. ${progressDone}/${total}`}
          tone="warm"
        />
      )}
      <details>
        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">Editar como texto</summary>
        <form action={replaceQueueItems} className="mt-1.5 flex flex-col gap-1.5">
          <input type="hidden" name="queueId" value={queueId} />
          {phaseId && <input type="hidden" name="phaseId" value={phaseId} />}
          <Textarea name="lines" defaultValue={itemsText} className="min-h-[120px] w-full" />
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Guardar lista
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
