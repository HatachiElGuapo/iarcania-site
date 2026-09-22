import { auth } from "@/lib/auth";
import { loadPlanContextForUser, type PlanContext } from "@/lib/plan/load";
import { PLAN_KINDS, kindInfo } from "@/lib/plan/kinds";
import { todayISO } from "@/lib/date/bogota";
import { Segmented, Card, Select, Input, Textarea, Labeled, Button, EmptyState } from "@/components/ui";
import { upsertBlock, deleteBlock } from "./actions";
import { replaceQueueItems } from "../fases/actions";

const WEEKDAY_ANCHORS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function PlanSemanaPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) {
    return <EmptyState icon="🗺️">Todavía no hay ningún plan importado.</EmptyState>;
  }

  const today = todayISO();
  const currentPhase = ctx.phases.find((p) => p.startDate <= today && today <= p.endDate) ?? null;

  return (
    <>
      <p className="mb-3 text-meta text-ink-dim">
        Editá la plantilla que se repite cada semana — un cambio acá afecta a todas las semanas, no un solo
        día.
      </p>
      <div className="mb-5">
        <Segmented
          options={WEEKDAY_SHORT.map((label, i) => ({
            label,
            href: `#${WEEKDAY_ANCHORS[i]}`,
            active: false,
          }))}
        />
      </div>

      <div className="flex flex-col gap-8">
        {WEEKDAY_LABELS.map((label, weekday) => (
          <section key={weekday} id={WEEKDAY_ANCHORS[weekday]} className="scroll-mt-4">
            <h2 className="mb-3 font-display text-[16px] font-bold text-ink">{label}</h2>
            <WeekdayGrid weekday={weekday} ctx={ctx} currentPhase={currentPhase} />
          </section>
        ))}
      </div>
    </>
  );
}

function WeekdayGrid({
  weekday,
  ctx,
  currentPhase,
}: {
  weekday: number;
  ctx: PlanContext;
  currentPhase: PlanContext["phases"][number] | null;
}) {
  const blocksForDay = ctx.blocks
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const queueItemsFor = (queueId: string, global: boolean) =>
    ctx.queueItems
      .filter((i) => i.queueId === queueId && i.phaseId === (global ? null : (currentPhase?.id ?? null)))
      .sort((a, b) => a.position - b.position)
      .map((i) => i.text)
      .join("\n");

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ctx.people.length}, minmax(0,1fr))` }}>
      {ctx.people.map((person) => {
        const blocks = blocksForDay.filter((b) => b.personId === person.id);
        return (
          <Card key={person.id} title={person.name} count={blocks.length} flush>
            <div className="flex flex-col divide-y divide-line">
              {blocks.map((b) => {
                const kind = kindInfo(b.kind);
                const queue = ctx.queues.find((q) => q.id === b.queueId);
                return (
                  <details key={b.id} className="px-3.5 py-2.5">
                    <summary className="flex cursor-pointer items-start gap-2">
                      <span className="shrink-0 pt-0.5 text-meta">{kind.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-meta text-ink-dim">
                          <span className="tabular-nums">
                            {b.startTime}
                            {b.endTime && `–${b.endTime}`}
                          </span>
                          <span style={{ color: kind.color }}>{kind.label}</span>
                          {queue && <span className="text-ink-dim">· {queue.name}</span>}
                          {b.isMinimum && <span className="text-accent-warm">· mínimo</span>}
                          {b.tentative && <span>· tentativo</span>}
                        </div>
                        <div className="text-body text-ink">{b.text}</div>
                      </div>
                    </summary>

                    <form action={upsertBlock} className="mt-2.5 flex flex-col gap-2.5 border-t border-line pt-2.5">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="weekday" value={weekday} />
                      <div className="flex flex-wrap gap-2.5">
                        <Labeled label="Persona">
                          <Select name="personId" defaultValue={b.personId} className="w-36">
                            {ctx.people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </Labeled>
                        <Labeled label="Inicio">
                          <Input type="time" name="startTime" defaultValue={b.startTime} className="w-28" required />
                        </Labeled>
                        <Labeled label="Fin (vacío = hasta dormir)">
                          <Input type="time" name="endTime" defaultValue={b.endTime ?? ""} className="w-28" />
                        </Labeled>
                        <Labeled label="Tipo">
                          <Select name="kind" defaultValue={b.kind} className="w-32">
                            {Object.entries(PLAN_KINDS).map(([key, k]) => (
                              <option key={key} value={key}>
                                {k.label}
                              </option>
                            ))}
                          </Select>
                        </Labeled>
                        <Labeled label="Cola (opcional)">
                          <Select name="queueId" defaultValue={b.queueId ?? ""} className="w-44">
                            <option value="">— sin cola —</option>
                            {ctx.queues.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.name}
                              </option>
                            ))}
                          </Select>
                        </Labeled>
                      </div>
                      <Labeled label="Texto">
                        <Input name="text" defaultValue={b.text} required />
                      </Labeled>
                      <Labeled label="Texto de festivo (opcional)">
                        <Input name="holidayText" defaultValue={b.holidayText ?? ""} />
                      </Labeled>
                      <div className="flex items-center gap-4 text-meta text-ink-muted">
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" name="isMinimum" defaultChecked={b.isMinimum} /> Mínimo
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" name="tentative" defaultChecked={b.tentative} /> Tentativo
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="submit" variant="secondary" size="sm">
                          Guardar
                        </Button>
                      </div>
                    </form>
                    <form action={deleteBlock} className="mt-2">
                      <input type="hidden" name="id" value={b.id} />
                      <Button type="submit" variant="danger" size="sm">
                        Eliminar
                      </Button>
                    </form>

                    {queue && (
                      <form
                        action={replaceQueueItems}
                        className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5"
                      >
                        <input type="hidden" name="queueId" value={queue.id} />
                        {!queue.global && <input type="hidden" name="phaseId" value={currentPhase?.id ?? ""} />}
                        <Labeled
                          label={`Próximas tareas de "${queue.name}"${currentPhase && !queue.global ? ` (${currentPhase.name})` : queue.global ? " (no se reinicia por fase)" : ""}`}
                        >
                          {!queue.global && !currentPhase ? (
                            <p className="text-meta text-ink-dim">
                              Hoy no cae dentro de ninguna fase — no hay a qué fase agregarle tareas.
                            </p>
                          ) : (
                            <Textarea
                              name="lines"
                              defaultValue={queueItemsFor(queue.id, queue.global)}
                              className="min-h-[100px] w-full"
                            />
                          )}
                        </Labeled>
                        {(queue.global || currentPhase) && (
                          <div>
                            <Button type="submit" variant="secondary" size="sm">
                              Guardar lista
                            </Button>
                          </div>
                        )}
                      </form>
                    )}
                  </details>
                );
              })}
            </div>

            <details className="border-t border-line px-3.5 py-2.5">
              <summary className="cursor-pointer text-meta text-ink-dim hover:text-ink">
                + Nuevo bloque para {person.name}
              </summary>
              <form action={upsertBlock} className="mt-2.5 flex flex-col gap-2.5">
                <input type="hidden" name="weekday" value={weekday} />
                <input type="hidden" name="personId" value={person.id} />
                <div className="flex flex-wrap gap-2.5">
                  <Labeled label="Inicio">
                    <Input type="time" name="startTime" className="w-28" required />
                  </Labeled>
                  <Labeled label="Fin (vacío = hasta dormir)">
                    <Input type="time" name="endTime" className="w-28" />
                  </Labeled>
                  <Labeled label="Tipo">
                    <Select name="kind" defaultValue="rutina" className="w-32">
                      {Object.entries(PLAN_KINDS).map(([key, k]) => (
                        <option key={key} value={key}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </Labeled>
                  <Labeled label="Cola (opcional)">
                    <Select name="queueId" defaultValue="" className="w-44">
                      <option value="">— sin cola —</option>
                      {ctx.queues.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </Select>
                  </Labeled>
                </div>
                <Labeled label="Texto">
                  <Input name="text" required />
                </Labeled>
                <Labeled label="Texto de festivo (opcional)">
                  <Input name="holidayText" />
                </Labeled>
                <div className="flex items-center gap-4 text-meta text-ink-muted">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="isMinimum" /> Mínimo
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="tentative" /> Tentativo
                  </label>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                    También en estos días
                  </span>
                  <div className="flex flex-wrap gap-2.5 text-meta text-ink-muted">
                    {WEEKDAY_SHORT.map((label, i) =>
                      i === weekday ? null : (
                        <label key={i} className="flex items-center gap-1">
                          <input type="checkbox" name="extraWeekdays" value={i} /> {label}
                        </label>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <Button type="submit" size="sm">
                    + Agregar
                  </Button>
                </div>
              </form>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
