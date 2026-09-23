import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks, planBlocks } from "@/lib/db/schema/plan";
import { loadPlanContextForUser, toPlanData } from "@/lib/plan/load";
import { resolvePlan, computeQueueProgress } from "@/lib/plan/resolve";
import { todayISO, diffDaysISO } from "@/lib/date/bogota";
import { Card, Input, Textarea, Select, Labeled, Button, Progress, EmptyState } from "@/components/ui";
import { listScriptOptions, type ScriptOption } from "@/lib/scripts-picker";
import { listBookOptions, type BookOption } from "@/lib/books-picker";
import {
  updatePhase,
  createPhase,
  deletePhase,
  createQueue,
  deleteQueue,
  addQueueItem,
  updateQueueItem,
  deleteQueueItem,
  moveQueueItem,
  replaceQueueItems,
} from "./actions";

export default async function PlanFasesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) {
    return <EmptyState icon="🗺️">Todavía no hay ningún plan importado.</EmptyState>;
  }

  const [scriptOptions, bookOptions] = await Promise.all([listScriptOptions(userId), listBookOptions(userId)]);

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
        Cada cola muestra su lista con lo que ya se hizo (según el historial de checks). Agregá, editá,
        borrá o moví un item de una — &ldquo;Pegar varios de una vez&rdquo; sigue disponible para cargar
        una lista larga de un tirón.
      </p>

      <Card title="Colas globales" className="mb-5">
        <p className="mb-2.5 text-meta text-ink-dim">
          No se reinician por fase — la posición sigue avanzando de una fase a la siguiente.
        </p>
        {globalQueues.length === 0 ? (
          <p className="mb-3 text-meta text-ink-dim">Sin colas globales todavía.</p>
        ) : (
          <div className="mb-3 flex flex-col gap-3">
            {globalQueues.map((q) => (
              <QueueList
                key={q.id}
                queueId={q.id}
                phaseId={null}
                name={`${q.name}${q.fallback ? ` (fallback: ${q.fallback})` : ""}`}
                items={itemsOf(q.id, null)}
                itemsText={itemsFor(q.id, null)}
                doneDateByQueueText={doneDateByQueueText}
                progressDone={queueProgress.get(q.id) ?? 0}
                scripts={scriptOptions}
                books={bookOptions}
              />
            ))}
          </div>
        )}
        <NewQueueForm />
      </Card>

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
              <Button type="submit" formAction={deletePhase} variant="danger" size="sm">
                🗑️ Borrar fase
              </Button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2">
              {phaseQueues.map((q) => (
                <QueueList
                  key={q.id}
                  queueId={q.id}
                  phaseId={phase.id}
                  name={q.name}
                  items={itemsOf(q.id, phase.id)}
                  itemsText={itemsFor(q.id, phase.id)}
                  doneDateByQueueText={doneDateByQueueText}
                  progressDone={queueProgress.get(`${phase.id}:${q.id}`) ?? 0}
                  scripts={scriptOptions}
                  books={bookOptions}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Nueva fase" className="mt-5">
        <form action={createPhase} className="flex flex-wrap items-end gap-2.5">
          <Labeled label="Nombre">
            <Input name="name" className="w-56" required />
          </Labeled>
          <Labeled label="Inicio">
            <Input type="date" name="startDate" className="w-40" required />
          </Labeled>
          <Labeled label="Fin">
            <Input type="date" name="endDate" className="w-40" required />
          </Labeled>
          <Labeled label="Meta" className="min-w-[220px] flex-1">
            <Input name="goal" className="w-full" />
          </Labeled>
          <Button type="submit" variant="secondary" size="sm">
            + Nueva fase
          </Button>
        </form>
      </Card>
    </>
  );
}

function NewQueueForm() {
  return (
    <form action={createQueue} className="flex flex-wrap items-end gap-2.5 border-t border-line pt-3">
      <Labeled label="Nombre de la cola">
        <Input name="name" className="w-48" required />
      </Labeled>
      <Labeled label="Fallback (opcional)" className="min-w-[160px] flex-1">
        <Input name="fallback" className="w-full" />
      </Labeled>
      <label className="flex items-center gap-1.5 pb-2 text-meta text-ink-muted">
        <input type="checkbox" name="cyclic" defaultChecked /> Cíclica
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-meta text-ink-muted">
        <input type="checkbox" name="global" /> Global (no se reinicia por fase)
      </label>
      <Button type="submit" variant="secondary" size="sm">
        + Nueva cola
      </Button>
    </form>
  );
}

type QueueItemData = {
  id: string;
  text: string;
  notes: string | null;
  scriptId: string | null;
  bookId: string | null;
};

function QueueList({
  queueId,
  phaseId,
  name,
  items,
  itemsText,
  doneDateByQueueText,
  progressDone,
  scripts,
  books,
}: {
  queueId: string;
  phaseId: string | null;
  name: string;
  items: QueueItemData[];
  itemsText: string;
  doneDateByQueueText: Map<string, string>;
  progressDone: number;
  scripts: ScriptOption[];
  books: BookOption[];
}) {
  const total = items.length;
  const doneCount = items.filter((i) => doneDateByQueueText.has(`${queueId}:${i.text}`)).length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">{name}</span>
        <form action={deleteQueue}>
          <input type="hidden" name="id" value={queueId} />
          <button type="submit" className="text-[10.5px] text-ink-dim hover:text-danger" title="Borrar cola (y todos sus items)">
            🗑️ Borrar cola
          </button>
        </form>
      </div>

      {total === 0 ? (
        <p className="text-meta text-ink-dim">Sin items todavía.</p>
      ) : (
        <div className="flex flex-col divide-y divide-line rounded-ui border border-line">
          {items.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              doneDate={doneDateByQueueText.get(`${queueId}:${item.text}`)}
              scripts={scripts}
              books={books}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <Progress
          label={`${doneCount} hecho${doneCount !== 1 ? "s" : ""} de ${total}`}
          pct={Math.min(100, Math.round((progressDone / total) * 100))}
          value={progressDone > total ? `pos. ${progressDone}/${total} (repitió)` : `pos. ${progressDone}/${total}`}
          tone="warm"
        />
      )}

      <form action={addQueueItem} className="flex gap-1.5">
        <input type="hidden" name="queueId" value={queueId} />
        {phaseId && <input type="hidden" name="phaseId" value={phaseId} />}
        <Input name="text" placeholder="Nuevo item…" className="flex-1" required />
        <Button type="submit" variant="secondary" size="sm">
          + Agregar
        </Button>
      </form>

      <details>
        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">Pegar varios de una vez</summary>
        <form action={replaceQueueItems} className="mt-1.5 flex flex-col gap-1.5">
          <input type="hidden" name="queueId" value={queueId} />
          {phaseId && <input type="hidden" name="phaseId" value={phaseId} />}
          <Textarea name="lines" defaultValue={itemsText} className="min-h-[120px] w-full" />
          <p className="text-[10.5px] text-ink-dim">Reemplaza TODA la lista — una línea por item.</p>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Reemplazar lista
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}

function QueueItemRow({
  item,
  doneDate,
  scripts,
  books,
}: {
  item: QueueItemData;
  doneDate: string | undefined;
  scripts: ScriptOption[];
  books: BookOption[];
}) {
  const linkedScript = item.scriptId ? scripts.find((s) => s.id === item.scriptId) : undefined;
  const linkedBook = item.bookId ? books.find((b) => b.id === item.bookId) : undefined;

  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 text-meta">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${doneDate ? "text-success" : "text-ink-dim"}`}>{doneDate ? "✓" : "○"}</span>
        <div className="min-w-0 flex-1">
          <span className={doneDate ? "text-ink-dim line-through" : "text-ink"}>{item.text}</span>
          {item.notes && <div className="mt-0.5 text-[11px] text-ink-dim">{item.notes}</div>}
          {(linkedScript || linkedBook) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {linkedScript && (
                <a
                  href={`/dashboard/guiones?canal=${linkedScript.canal}&open=${linkedScript.id}#script-${linkedScript.id}`}
                  className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10.5px] text-ink hover:underline"
                >
                  🎬 {linkedScript.title}
                </a>
              )}
              {linkedBook && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-muted">
                  📖 {linkedBook.title}
                </span>
              )}
            </div>
          )}
        </div>
        {doneDate && <span className="shrink-0 tabular-nums text-ink-dim">{doneDate}</span>}
        <div className="flex shrink-0 gap-0.5">
          <form action={moveQueueItem}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" className="px-1 text-ink-dim hover:text-ink" aria-label="Mover arriba">
              ↑
            </button>
          </form>
          <form action={moveQueueItem}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" className="px-1 text-ink-dim hover:text-ink" aria-label="Mover abajo">
              ↓
            </button>
          </form>
        </div>
      </div>

      <details className="ml-5">
        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">✎ Editar</summary>
        <form action={updateQueueItem} className="mt-1.5 flex flex-col gap-1.5">
          <input type="hidden" name="id" value={item.id} />
          <Input name="text" defaultValue={item.text} required />
          <Textarea name="notes" defaultValue={item.notes ?? ""} placeholder="Nota (opcional)" rows={2} />
          <div className="flex flex-wrap gap-1.5">
            <Select name="scriptId" defaultValue={item.scriptId ?? ""} className="min-w-[160px] flex-1">
              <option value="">— Sin guion —</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <Select name="bookId" defaultValue={item.bookId ?? ""} className="min-w-[160px] flex-1">
              <option value="">— Sin libro —</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Guardar
            </Button>
            <Button type="submit" formAction={deleteQueueItem} variant="danger" size="sm">
              Borrar item
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
