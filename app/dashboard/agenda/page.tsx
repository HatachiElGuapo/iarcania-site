import { auth } from "@/lib/auth";
import { buildDayEvents } from "@/lib/agenda/day-events";
import { createBlock, updateBlock } from "./actions";
import { todayISO, addDaysISO as addDays, nowHHMM } from "@/lib/date/bogota";
import { DayGrid } from "./day-grid";
import { DraggableTask } from "./draggable-task";
import { PageHeader, Button, Card, Stepper, ItemList, ItemRow, Input, Select } from "@/components/ui";

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; pre?: string; edit?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { date: dateParam, pre, edit } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
  const isToday = date === todayISO();

  const { events, agendaItemsRaw, pendingTasks, backlog, citasPendientes, freeMinutes, occupancy } =
    await buildDayEvents(userId, date);

  const gridCount = events.length;
  const nowMinutes = toMinutes(nowHHMM());
  const totalScheduled = 24 * 60 - freeMinutes;
  const freeTicks = Math.floor(freeMinutes / 10);

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  const editBlock = edit ? agendaItemsRaw.find((b) => b.id === edit) ?? null : null;

  return (
    <div className="p-8">
      <PageHeader
        icon="📅"
        title="Agenda"
        subtitle={`${dateLong} · ${gridCount} bloque${gridCount !== 1 ? "s" : ""} · libre ${fmtDur(freeMinutes)}`}
        actions={
          <>
            <Stepper
              prevHref={`/dashboard/agenda?date=${addDays(date, -1)}`}
              nextHref={`/dashboard/agenda?date=${addDays(date, 1)}`}
              label={isToday ? "Hoy" : date}
              current={isToday}
            />
            {!isToday && (
              <Button variant="secondary" href={`/dashboard/agenda?date=${todayISO()}`}>
                Hoy
              </Button>
            )}
            <Button href="#agregar-bloque">+ Bloque</Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <DayGrid date={date} isToday={isToday} nowMinutes={nowMinutes} events={events} />

          {editBlock && (
            <form
              action={updateBlock}
              className="flex flex-wrap items-center gap-2 rounded-ui-lg border border-line bg-surface p-3"
            >
              <input type="hidden" name="id" value={editBlock.id} />
              <span className="text-meta text-ink-dim">Editando bloque de las {editBlock.blockTime}:</span>
              <Input
                type="time"
                name="blockTime"
                step={600}
                defaultValue={editBlock.blockTime}
                required
                aria-label="Hora"
                className="w-auto"
              />
              <Input
                type="number"
                name="duration"
                defaultValue={editBlock.duration}
                min={10}
                step={10}
                aria-label="Duración en minutos"
                className="w-20"
              />
              <Input
                type="text"
                name="notes"
                defaultValue={editBlock.notes ?? ""}
                placeholder="Notas…"
                aria-label="Notas"
                className="min-w-[140px] flex-1"
              />
              <Button type="submit">Guardar</Button>
              <Button variant="secondary" href={`/dashboard/agenda?date=${date}`}>
                Cancelar
              </Button>
            </form>
          )}

          <form
            action={createBlock}
            id="agregar-bloque"
            className="flex flex-wrap items-center gap-2 rounded-ui-lg border border-line bg-surface p-3"
          >
            <input type="hidden" name="date" value={date} />
            <Input type="time" name="blockTime" step={600} required aria-label="Hora" className="w-auto" />
            <Input
              type="number"
              name="duration"
              defaultValue={20}
              min={10}
              step={10}
              aria-label="Duración en minutos"
              className="w-20"
            />
            <Select name="itemType" defaultValue={pre ? "task" : "nota"} aria-label="Tipo de bloque">
              <option value="nota">Nota libre</option>
              <option value="task">Tarea vinculada</option>
            </Select>
            <Select name="itemId" defaultValue={pre ?? ""} aria-label="Tarea a vincular">
              <option value="">—</option>
              {pendingTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            <Input
              type="text"
              name="notes"
              placeholder="Notas…"
              aria-label="Notas"
              className="min-w-[140px] flex-1"
            />
            <Button type="submit">+ Agregar</Button>
          </form>
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-4">
          <div id="agenda-backlog">
            <Card title="Sin agendar" count={backlog.length} flush>
              {backlog.length === 0 ? (
                <p className="px-3.5 py-4 text-xs text-ink-muted">
                  Todo lo pendiente ya está agendado para este día.
                </p>
              ) : (
                <div className="p-3">
                  <ItemList>
                    {backlog.map((t) => (
                      <DraggableTask key={t.id} id={t.id}>
                        <ItemRow
                          href={`/dashboard/agenda?date=${date}&pre=${t.id}#agregar-bloque`}
                          category={t.category}
                          title={t.title}
                          trailing={
                            <>
                              <span className="shrink-0 text-[10px] text-ink-dim">20 min</span>
                              <span className="shrink-0 text-ink-dim">⠿</span>
                            </>
                          }
                        />
                      </DraggableTask>
                    ))}
                  </ItemList>
                </div>
              )}
            </Card>
          </div>

          {citasPendientes.length > 0 && (
            <Card title="Citas por agendar" flush>
              <div className="flex flex-col gap-1.5 p-3">
                {citasPendientes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-ui border border-accent-warm/20 bg-accent-warm/[0.05] px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-ink">{c.title}</div>
                      <div className="mt-0.5 text-meta text-accent-warm">
                        {c.datetime.toLocaleString("es-CO", {
                          timeZone: "America/Bogota",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="shrink-0 text-meta text-ink-dim">Agendar</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Ocupación del día">
            {occupancy.length === 0 ? (
              <p className="text-xs text-ink-muted">Nada agendado todavía.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {occupancy.map((o) => (
                  <div key={o.key} className="flex items-center gap-2.5 text-xs text-ink-muted">
                    <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: o.color }} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className="h-1 max-w-[74px] flex-1 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.min(100, (o.minutes / Math.max(1, totalScheduled)) * 100)}%`,
                          background: o.color,
                        }}
                      />
                    </span>
                    <span className="min-w-[44px] shrink-0 text-right text-meta text-ink-dim">
                      {fmtDur(o.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-meta text-ink-dim">
              Libre: {fmtDur(freeMinutes)} en {freeTicks} ticks sueltos
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
