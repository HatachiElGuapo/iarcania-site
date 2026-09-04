import { and, asc, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { tasks } from "@/lib/db/schema/trabajo";
import { appointments } from "@/lib/db/schema/citas";
import { CATS } from "@/lib/constants/cats";
import { createBlock, updateBlock } from "./actions";
import { todayISO, addDaysISO as addDays, nowHHMM } from "@/lib/date/bogota";
import { DayGrid, type AgendaEvent } from "./day-grid";
import {
  PageHeader,
  Button,
  Card,
  Stepper,
  ItemList,
  ItemRow,
  Input,
  Select,
  catInfo,
} from "@/components/ui";

const TYPE_META: Record<string, { icon: string; label: string; accent: string }> = {
  task: { icon: "✅", label: "Tarea", accent: "#8B5CF6" }, // accent
  cita: { icon: "📞", label: "Cita", accent: "#E8A33D" }, // accent-warm
  nota: { icon: "📝", label: "Nota", accent: "#5DCAA5" }, // category-personal
  habito: { icon: "🔁", label: "Hábito", accent: CATS.habitos.color },
};

const DAY_START = 0;
const DAY_END = 24 * 60;

// Hábitos de rutina diaria = filas de `activities` con frequency='diaria' e
// isActive. Se dibujan como bloques VIRTUALES para el día que se ve (no se
// persisten): así valen para fechas pasadas/futuras sin backfill, y cambiar
// la hora en Hábitos se refleja en cada día. Al arrastrarlos en la agenda se
// materializan como fila real (itemType='habito') SOLO para ese día.
const HABIT_DURATION = 20;
const HABIT_FALLBACK_START = 6 * 60;

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

  const [blocks, pendingTasks, citas, dailyHabits, habitLogs] = await Promise.all([
    db
      .select()
      .from(agendaItems)
      .where(and(eq(agendaItems.userId, userId), eq(agendaItems.date, date)))
      .orderBy(asc(agendaItems.blockTime)),
    db
      .select({ id: tasks.id, title: tasks.title, category: tasks.category })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada"), ne(tasks.status, "completada")))
      .orderBy(asc(tasks.title)),
    db
      .select({ id: appointments.id, title: appointments.title, datetime: appointments.datetime })
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.status, "pendiente"))),
    db
      .select({ id: activities.id, name: activities.name, horaSugerida: activities.horaSugerida })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.isActive, true),
          eq(activities.frequency, "diaria"),
        ),
      )
      .orderBy(asc(activities.horaSugerida), asc(activities.sortOrder), asc(activities.name)),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date))),
  ]);

  const taskById = new Map(pendingTasks.map((t) => [t.id, t]));
  const citaTitleById = new Map(citas.map((c) => [c.id, c.title]));
  const habitNameById = new Map(dailyHabits.map((h) => [h.id, h.name]));
  const scheduledTaskIds = new Set(blocks.filter((b) => b.itemType === "task" && b.itemId).map((b) => b.itemId));
  const backlog = pendingTasks.filter((t) => !scheduledTaskIds.has(t.id));

  // Hábitos ya materializados como bloque real para este día: no se dibuja su
  // versión virtual.
  const overriddenHabitIds = new Set(
    blocks.filter((b) => b.itemType === "habito" && b.itemId).map((b) => b.itemId as string),
  );
  const doneHabitIds = new Set(habitLogs.map((l) => l.activityId));

  let habitCursor = HABIT_FALLBACK_START;
  const virtualHabits = dailyHabits
    .filter((h) => !overriddenHabitIds.has(h.id))
    .map((h) => {
      const hasTime = !!h.horaSugerida && /^\d{1,2}:\d{2}$/.test(h.horaSugerida);
      const start = hasTime ? toMinutes(h.horaSugerida as string) : habitCursor;
      if (!hasTime) habitCursor += HABIT_DURATION;
      return { id: h.id, name: h.name, start, autoTime: !hasTime, done: doneHabitIds.has(h.id) };
    });

  const blockEvents: AgendaEvent[] = blocks.map((b) => {
    const meta = TYPE_META[b.itemType] ?? TYPE_META.nota;
    const title =
      b.itemType === "cita"
        ? citaTitleById.get(b.itemId ?? "") ?? b.notes ?? "(sin título)"
        : b.itemType === "task"
          ? taskById.get(b.itemId ?? "")?.title ?? b.notes ?? "(sin título)"
          : b.itemType === "habito"
            ? habitNameById.get(b.itemId ?? "") ?? b.notes ?? "Hábito"
            : b.notes ?? "(sin título)";
    return {
      key: `block-${b.id}`,
      kind: "block",
      refId: b.id,
      itemType: b.itemType,
      start: toMinutes(b.blockTime),
      duration: b.duration,
      title,
      accent: meta.accent,
      icon: meta.icon,
      badge: meta.label,
      done: b.itemType === "habito" && b.itemId ? doneHabitIds.has(b.itemId) : false,
      autoTime: false,
      editHref: `/dashboard/agenda?date=${date}&edit=${b.id}`,
    };
  });

  const habitEvents: AgendaEvent[] = virtualHabits.map((h) => ({
    key: `habit-${h.id}`,
    kind: "habit",
    refId: h.id,
    itemType: "habit",
    start: h.start,
    duration: HABIT_DURATION,
    title: h.name,
    accent: CATS.habitos.color,
    icon: "🔁",
    badge: h.autoTime ? "Hábito · sin hora" : "Hábito",
    done: h.done,
    autoTime: h.autoTime,
    editHref: null,
  }));

  const agendaEvents = [...blockEvents, ...habitEvents];
  const gridCount = agendaEvents.length;
  const nowMinutes = toMinutes(nowHHMM());

  const habitMinutes = habitEvents.reduce((sum, h) => sum + h.duration, 0);
  const totalScheduled = blocks.reduce((sum, b) => sum + b.duration, 0) + habitMinutes;
  const freeMinutes = Math.max(0, DAY_END - DAY_START - totalScheduled);
  const freeTicks = Math.floor(freeMinutes / 10);

  const occByKey = new Map<string, { label: string; color: string; minutes: number }>();
  const bump = (key: string, label: string, color: string, minutes: number) => {
    const ex = occByKey.get(key);
    if (ex) ex.minutes += minutes;
    else occByKey.set(key, { label, color, minutes });
  };
  for (const b of blocks) {
    if (b.itemType === "task") {
      const t = b.itemId ? taskById.get(b.itemId) : undefined;
      const c = t?.category ? catInfo(t.category) : null;
      bump(t?.category ?? "sin-categoria", c?.label ?? "Sin categoría", c?.color ?? "#5A5870", b.duration);
    } else if (b.itemType === "cita") {
      bump("cita", "Citas", TYPE_META.cita.accent, b.duration);
    } else if (b.itemType === "habito") {
      bump("habitos", "Hábitos", CATS.habitos.color, b.duration);
    } else {
      bump("nota", "Notas", TYPE_META.nota.accent, b.duration);
    }
  }
  if (habitMinutes > 0) bump("habitos", "Hábitos", CATS.habitos.color, habitMinutes);
  const occupancy = [...occByKey.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.minutes - a.minutes);

  const dateLong = capitalize(
    new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  const editBlock = edit ? blocks.find((b) => b.id === edit) ?? null : null;

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
          <DayGrid date={date} isToday={isToday} nowMinutes={nowMinutes} events={agendaEvents} />

          {editBlock && (
            <form
              action={updateBlock}
              className="flex flex-wrap items-center gap-2 rounded-ui-lg border border-line bg-surface p-3"
            >
              <input type="hidden" name="id" value={editBlock.id} />
              <span className="text-[11px] text-ink-dim">Editando bloque de las {editBlock.blockTime}:</span>
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
          <Card title="Sin agendar" count={backlog.length} flush>
            {backlog.length === 0 ? (
              <p className="px-3.5 py-4 text-xs text-ink-muted">
                Todo lo pendiente ya está agendado para este día.
              </p>
            ) : (
              <div className="p-3">
                <ItemList>
                  {backlog.map((t) => (
                    <ItemRow
                      key={t.id}
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
                  ))}
                </ItemList>
              </div>
            )}
          </Card>

          {citas.length > 0 && (
            <Card title="Citas por agendar" flush>
              <div className="flex flex-col gap-1.5 p-3">
                {citas.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-ui border border-accent-warm/20 bg-accent-warm/[0.05] px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-ink">{c.title}</div>
                      <div className="mt-0.5 text-[11px] text-accent-warm">
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
                    <span className="shrink-0 text-[11px] text-ink-dim">Agendar</span>
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
                    <span className="min-w-[44px] shrink-0 text-right text-[11px] text-ink-dim">
                      {fmtDur(o.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-[11px] text-ink-dim">
              Libre: {fmtDur(freeMinutes)} en {freeTicks} ticks sueltos
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
