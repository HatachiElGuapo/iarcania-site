import { auth } from "@/lib/auth";
import { loadPlanContext } from "@/lib/plan/load";
import { PageHeader, Card, Input, Textarea, Labeled, Button, EmptyState } from "@/components/ui";
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
            {globalQueues.map((q) => (
              <form key={q.id} action={replaceQueueItems} className="flex flex-col gap-1.5">
                <input type="hidden" name="queueId" value={q.id} />
                <Labeled label={`${q.name}${q.fallback ? ` (fallback: ${q.fallback})` : ""}`}>
                  <Textarea name="lines" defaultValue={itemsFor(q.id, null)} className="min-h-[120px] w-full" />
                </Labeled>
                <div>
                  <Button type="submit" variant="secondary" size="sm">
                    Guardar lista
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {ctx.phases.map((phase) => (
          <Card key={phase.id} title={phase.name}>
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
                <form key={q.id} action={replaceQueueItems} className="flex flex-col gap-1.5">
                  <input type="hidden" name="queueId" value={q.id} />
                  <input type="hidden" name="phaseId" value={phase.id} />
                  <Labeled label={q.name}>
                    <Textarea name="lines" defaultValue={itemsFor(q.id, phase.id)} className="min-h-[140px] w-full" />
                  </Labeled>
                  <div>
                    <Button type="submit" variant="secondary" size="sm">
                      Guardar lista
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
