// Arma la lista de eventos de un día — bloques de agenda, tareas
// agendadas/sin agendar, citas, hábitos (virtuales o materializados) y
// bloques de Plan — en un solo lugar. Usado por /dashboard/agenda (la
// grilla) y por /dashboard (Rutinas, como lista mezclada por hora): antes
// cada página tenía su propia copia de esta lógica y se desincronizaban.
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agendaItems } from "@/lib/db/schema/agenda";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { tasks } from "@/lib/db/schema/trabajo";
import { appointments } from "@/lib/db/schema/citas";
import { planBlocks, planBlockActivities, planChecks } from "@/lib/db/schema/plan";
import { CATS } from "@/lib/constants/cats";
import { catInfo } from "@/components/ui/category";
import { findPlanPersonForUser, loadPlanContextById, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { kindInfo } from "@/lib/plan/kinds";
import { addDaysISO } from "@/lib/date/bogota";

export type AgendaEvent = {
  key: string;
  kind: "block" | "habit" | "plan";
  refId: string; // agenda_items.id (block) | activities.id (habit) | plan_blocks.id (plan)
  itemType: string; // task | nota | cita | habito | habit | plan
  start: number; // minutos desde 00:00
  duration: number;
  title: string;
  accent: string; // hex
  icon: string;
  badge: string;
  done: boolean;
  autoTime: boolean; // hábito sin hora fija
  editHref: string | null;
  // Solo bloques de Plan con hábitos enlazados: un check por hábito, en vez
  // de pintar cada hábito aparte.
  habitChecks?: { name: string; done: boolean }[];
  // Override del final mostrado (ej. "24:00" en vez de "00:00" para un
  // bloque sin end que llega hasta la medianoche) — no cambia `duration`.
  endLabel?: string;
};

const TYPE_META: Record<string, { icon: string; label: string; accent: string }> = {
  task: { icon: "✅", label: "Tarea", accent: "#8B5CF6" },
  cita: { icon: "📞", label: "Cita", accent: "#E8A33D" },
  nota: { icon: "📝", label: "Nota", accent: "#5DCAA5" },
  habito: { icon: "🔁", label: "Hábito", accent: CATS.habitos.color },
};

export const DAY_START = 0;
export const DAY_END = 24 * 60;
const HABIT_DURATION = 20;
const HABIT_FALLBACK_START = 6 * 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type DayEventsResult = {
  events: AgendaEvent[];
  agendaItemsRaw: (typeof agendaItems.$inferSelect)[];
  pendingTasks: { id: string; title: string; category: string | null }[];
  backlog: { id: string; title: string; category: string | null }[];
  citasPendientes: { id: string; title: string; datetime: Date }[];
  freeMinutes: number;
  totalScheduled: number;
  occupancy: { key: string; label: string; color: string; minutes: number }[];
};

export async function buildDayEvents(userId: string, date: string): Promise<DayEventsResult> {
  const [blocks, allTasks, citas, dailyHabits, habitLogs] = await Promise.all([
    db
      .select()
      .from(agendaItems)
      .where(and(eq(agendaItems.userId, userId), eq(agendaItems.date, date)))
      .orderBy(agendaItems.blockTime),
    // Incluye completadas (no solo pendientes): un bloque de agenda de una
    // tarea ya marcada hecha necesita su título y su estado igual — si acá
    // se filtraran, blockEvents perdería el título (queda "(sin título)") y
    // el check de "hecho" nunca se vería en la lista.
    db
      .select({ id: tasks.id, title: tasks.title, category: tasks.category, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada")))
      .orderBy(tasks.title),
    db
      .select({ id: appointments.id, title: appointments.title, datetime: appointments.datetime })
      .from(appointments)
      .where(and(eq(appointments.userId, userId), eq(appointments.status, "pendiente"))),
    db
      .select({ id: activities.id, name: activities.name, horaSugerida: activities.horaSugerida })
      .from(activities)
      .where(and(eq(activities.userId, userId), eq(activities.isActive, true), eq(activities.frequency, "diaria"))),
    db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, date))),
  ]);

  const doneHabitIds = new Set(habitLogs.map((l) => l.activityId));

  // Bloques resueltos de Plan para la columna de este usuario (si tiene una
  // en algún plan). Un bloque puede tener uno o más hábitos enlazados
  // (plan_block_activities); esos hábitos NO se pintan aparte más abajo
  // (virtuales ni materializados). Un bloque con end null (ej. Dormir) sigue
  // hasta el primer bloque de HOY (o hasta las 24:00 si no hay ninguno) y
  // además aparece como "cola" de 00:00 al primer bloque de hoy si el
  // bloque abierto es el de AYER — dos tramos del mismo bloque, no uno
  // duplicado.
  const yesterday = addDaysISO(date, -1);
  const planPerson = await findPlanPersonForUser(userId);
  let planBlockEvents: AgendaEvent[] = [];
  let linkedActivityIds = new Set<string>();
  if (planPerson) {
    const planCtx = await loadPlanContextById(planPerson.planId);
    const resolvedRange = resolvePlan(toPlanData(planCtx), yesterday, date);
    const todayResolved = resolvedRange.find((d) => d.date === date) ?? null;
    const before = resolvedRange.find((d) => d.date === yesterday) ?? null;
    const todaysBlocks = todayResolved?.blocksByPerson[planPerson.personId] ?? [];
    const carryBlocks = (before?.blocksByPerson[planPerson.personId] ?? []).filter((b) => !b.endTime);

    const linkRows = await db
      .select({ blockId: planBlockActivities.blockId, activityId: planBlockActivities.activityId, name: activities.name })
      .from(planBlockActivities)
      .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
      .innerJoin(planBlocks, eq(planBlocks.id, planBlockActivities.blockId))
      .where(eq(planBlocks.planId, planPerson.planId));
    linkedActivityIds = new Set(linkRows.map((r) => r.activityId));
    const habitsByBlockId = new Map<string, { activityId: string; name: string }[]>();
    for (const r of linkRows) {
      const list = habitsByBlockId.get(r.blockId) ?? [];
      list.push({ activityId: r.activityId, name: r.name });
      habitsByBlockId.set(r.blockId, list);
    }
    const buildHabitChecks = (blockId: string, doneSet: Set<string>) =>
      (habitsByBlockId.get(blockId) ?? []).map((h) => ({ name: h.name, done: doneSet.has(h.activityId) }));

    const planChecksRows = await db
      .select({ blockId: planChecks.blockId, date: planChecks.date, status: planChecks.status })
      .from(planChecks)
      .where(and(eq(planChecks.planId, planPerson.planId), inArray(planChecks.date, [date, yesterday])));
    const planCheckByKey = new Map(planChecksRows.map((c) => [`${c.date}:${c.blockId}`, c.status]));

    const yesterdayLogs = linkedActivityIds.size
      ? await db
          .select({ activityId: activityLogs.activityId })
          .from(activityLogs)
          .where(and(eq(activityLogs.userId, userId), eq(activityLogs.date, yesterday)))
      : [];
    const yesterdayDoneIds = new Set(yesterdayLogs.map((l) => l.activityId));

    const firstBlockStart = todaysBlocks.length ? Math.min(...todaysBlocks.map((b) => toMinutes(b.startTime))) : DAY_END;

    const carryEvents: AgendaEvent[] = carryBlocks.map((b) => {
      const info = kindInfo(b.kind);
      return {
        key: `plan-carry-${b.blockId}`,
        kind: "plan",
        refId: b.blockId,
        itemType: "plan",
        start: 0,
        duration: Math.max(1, firstBlockStart),
        title: b.text,
        accent: info.color,
        icon: info.icon,
        badge: info.label,
        done: planCheckByKey.get(`${yesterday}:${b.blockId}`) === "done",
        autoTime: false,
        editHref: `/dashboard/plan?date=${yesterday}`,
        habitChecks: buildHabitChecks(b.blockId, yesterdayDoneIds),
      };
    });

    const todayEvents: AgendaEvent[] = todaysBlocks.map((b) => {
      const info = kindInfo(b.kind);
      const start = toMinutes(b.startTime);
      const endMinutes = b.endTime ? toMinutes(b.endTime) : DAY_END;
      return {
        key: `plan-${b.blockId}`,
        kind: "plan",
        refId: b.blockId,
        itemType: "plan",
        start,
        duration: Math.max(1, endMinutes - start),
        title: b.text,
        accent: info.color,
        icon: info.icon,
        badge: info.label,
        done: planCheckByKey.get(`${date}:${b.blockId}`) === "done",
        autoTime: false,
        editHref: `/dashboard/plan?date=${date}`,
        habitChecks: buildHabitChecks(b.blockId, doneHabitIds),
        endLabel: b.endTime ? undefined : "24:00",
      };
    });

    planBlockEvents = [...carryEvents, ...todayEvents];
  }

  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const citaTitleById = new Map(citas.map((c) => [c.id, c.title]));
  const habitNameById = new Map(dailyHabits.map((h) => [h.id, h.name]));
  const scheduledTaskIds = new Set(blocks.filter((b) => b.itemType === "task" && b.itemId).map((b) => b.itemId));
  const pendingTasks = allTasks.filter((t) => t.status !== "completada");
  const backlog = pendingTasks.filter((t) => !scheduledTaskIds.has(t.id));

  // Hábitos ya materializados como bloque real para este día: no se dibuja su
  // versión virtual. Los enlazados a un bloque de Plan tampoco — se pintan
  // ahí, no aparte.
  const overriddenHabitIds = new Set(
    blocks.filter((b) => b.itemType === "habito" && b.itemId).map((b) => b.itemId as string),
  );

  let habitCursor = HABIT_FALLBACK_START;
  const virtualHabits = dailyHabits
    .filter((h) => !overriddenHabitIds.has(h.id) && !linkedActivityIds.has(h.id))
    .map((h) => {
      const hasTime = !!h.horaSugerida && /^\d{1,2}:\d{2}$/.test(h.horaSugerida);
      const start = hasTime ? toMinutes(h.horaSugerida as string) : habitCursor;
      if (!hasTime) habitCursor += HABIT_DURATION;
      return { id: h.id, name: h.name, start, autoTime: !hasTime, done: doneHabitIds.has(h.id) };
    });

  const blockEvents: AgendaEvent[] = blocks
    .filter((b) => !(b.itemType === "habito" && b.itemId && linkedActivityIds.has(b.itemId)))
    .map((b) => {
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
        kind: "block" as const,
        refId: b.id,
        itemType: b.itemType,
        start: toMinutes(b.blockTime),
        duration: b.duration,
        title,
        accent: meta.accent,
        icon: meta.icon,
        badge: meta.label,
        done:
          b.itemType === "habito" && b.itemId
            ? doneHabitIds.has(b.itemId)
            : b.itemType === "task" && b.itemId
              ? taskById.get(b.itemId)?.status === "completada"
              : false,
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

  const events = [...blockEvents, ...habitEvents, ...planBlockEvents];

  const habitMinutes = habitEvents.reduce((sum, h) => sum + h.duration, 0);
  const planMinutes = planBlockEvents.reduce((sum, b) => sum + b.duration, 0);
  const totalScheduled = blocks.reduce((sum, b) => sum + b.duration, 0) + habitMinutes + planMinutes;
  const freeMinutes = Math.max(0, DAY_END - DAY_START - totalScheduled);

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
  for (const p of planBlockEvents) bump(`plan-${p.badge}`, `Plan · ${p.badge}`, p.accent, p.duration);
  const occupancy = [...occByKey.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.minutes - a.minutes);

  return {
    events,
    agendaItemsRaw: blocks,
    pendingTasks,
    backlog,
    citasPendientes: citas,
    freeMinutes,
    totalScheduled,
    occupancy,
  };
}
