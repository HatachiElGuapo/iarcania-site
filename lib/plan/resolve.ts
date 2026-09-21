// Resolver puro de Plan: recibe el plan completo (ya cargado de la base, sin
// más queries acá dentro) y un rango de fechas, y devuelve día por día la
// fase activa, si es festivo, y los bloques/eventos resueltos.
//
// Reglas (docs/plan/plan-iarcania-spec.md § Resolver), en este orden:
//  1. Recorre día a día desde plan.startDate aunque el rango pedido empiece
//     después — los contadores de las colas dependen de todo lo anterior.
//  2. Bloques del día = plan_blocks de ese weekday (0=lunes…6=domingo).
//  3. Festivo + el bloque tiene holidayText → usa ese texto, no avanza el
//     contador de su cola.
//  4. Bloque con cola → contador por (fase, cola), o solo por cola si es
//     global. Cíclica vuelve a empezar; no cíclica usa el fallback una vez
//     agotada.
//  5. plan_overrides se aplican DESPUÉS de avanzar el contador.
//  6. Eventos del día (por fecha o por month_day), ordenados por hora.
import { addDaysISO, weekdayMon0 } from "@/lib/date/bogota";

export type PlanPerson = { id: string; name: string; color: string };

export type PlanPhase = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: string | null;
};

export type PlanQueue = {
  id: string;
  key: string;
  name: string;
  cyclic: boolean;
  global: boolean;
  fallback: string | null;
};

export type PlanQueueItem = {
  queueId: string;
  phaseId: string | null;
  position: number;
  text: string;
};

export type PlanBlockDef = {
  id: string;
  personId: string;
  weekday: number; // 0-6, 0=lunes
  startTime: string;
  endTime: string | null;
  text: string;
  kind: string;
  tentative: boolean;
  isMinimum: boolean;
  queueId: string | null;
  holidayText: string | null;
};

export type PlanOverride = {
  date: string;
  blockId: string;
  text: string | null;
  removed: boolean;
  // startTime no nulo = se movió (ej. arrastrado en Agenda) solo para ese
  // día. durationMinutes es la duración original del bloque — null si el
  // bloque es abierto (ej. Dormir), para que siga abierto en el horario
  // nuevo.
  startTime: string | null;
  durationMinutes: number | null;
};

export type PlanEventDef = {
  id: string;
  personId: string | null;
  date: string | null;
  monthDay: number | null;
  startTime: string | null;
  endTime: string | null;
  text: string;
  kind: string | null;
};

export type PlanData = {
  startDate: string;
  endDate: string;
  people: PlanPerson[];
  phases: PlanPhase[];
  queues: PlanQueue[];
  queueItems: PlanQueueItem[];
  blocks: PlanBlockDef[];
  holidays: string[];
  events: PlanEventDef[];
  overrides: PlanOverride[];
};

export type ResolvedBlock = {
  blockId: string;
  personId: string;
  startTime: string;
  endTime: string | null;
  text: string;
  kind: string;
  tentative: boolean;
  isMinimum: boolean;
  isHoliday: boolean;
};

export type ResolvedEvent = {
  eventId: string;
  personId: string | null;
  startTime: string | null;
  endTime: string | null;
  text: string;
  kind: string | null;
};

export type ResolvedDay = {
  date: string;
  phase: PlanPhase | null;
  isHoliday: boolean;
  blocksByPerson: Record<string, ResolvedBlock[]>;
  events: ResolvedEvent[];
};

function findPhase(phases: PlanPhase[], date: string): PlanPhase | null {
  return phases.find((p) => p.startDate <= date && date <= p.endDate) ?? null;
}

// Suma minutos a "HH:MM", sin pasar de 23:59 (un bloque movido no cruza
// medianoche — eso ya lo maneja el caso de bloque abierto, endTime null).
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Progreso de cada cola al final de `throughDate` (inclusive) — cuántas
// veces se consumió cada (fase, cola) o cada cola global, sin resolver
// texto (más liviano que resolvePlan cuando solo hace falta el número).
// Misma clave que el contador interno de resolvePlan: queueId solo si es
// global, si no `${phaseId}:${queueId}`. Replica las mismas reglas
// (festivo con holiday_text no avanza; sin items en la lista tampoco).
export function computeQueueProgress(plan: PlanData, throughDate: string): Map<string, number> {
  const holidaySet = new Set(plan.holidays);
  const queueById = new Map(plan.queues.map((q) => [q.id, q]));
  const itemCountByQueuePhase = new Map<string, number>();
  for (const item of plan.queueItems) {
    const key = `${item.queueId}:${item.phaseId ?? ""}`;
    itemCountByQueuePhase.set(key, (itemCountByQueuePhase.get(key) ?? 0) + 1);
  }
  const blocksByWeekday = new Map<number, PlanBlockDef[]>();
  for (const b of plan.blocks) {
    if (!b.queueId) continue;
    const list = blocksByWeekday.get(b.weekday) ?? [];
    list.push(b);
    blocksByWeekday.set(b.weekday, list);
  }

  const counters = new Map<string, number>();
  let cur = plan.startDate;
  while (cur <= throughDate) {
    const isHoliday = holidaySet.has(cur);
    const phase = findPhase(plan.phases, cur);
    const weekday = weekdayMon0(cur);
    for (const b of blocksByWeekday.get(weekday) ?? []) {
      if (isHoliday && b.holidayText) continue; // regla 3: no avanza
      const queue = queueById.get(b.queueId!);
      if (!queue) continue;
      const phaseId = queue.global ? null : (phase?.id ?? null);
      const itemCount = itemCountByQueuePhase.get(`${queue.id}:${phaseId ?? ""}`) ?? 0;
      if (itemCount === 0) continue; // sin items, no avanza (igual que resolvePlan)
      const counterKey = queue.global ? queue.id : `${phaseId ?? ""}:${queue.id}`;
      counters.set(counterKey, (counters.get(counterKey) ?? 0) + 1);
    }
    cur = addDaysISO(cur, 1);
  }
  return counters;
}

export function resolvePlan(plan: PlanData, fromDate: string, toDate: string): ResolvedDay[] {
  const holidaySet = new Set(plan.holidays);
  const queueById = new Map(plan.queues.map((q) => [q.id, q]));
  const itemsByQueue = new Map<string, PlanQueueItem[]>();
  for (const item of plan.queueItems) {
    const list = itemsByQueue.get(item.queueId) ?? [];
    list.push(item);
    itemsByQueue.set(item.queueId, list);
  }
  for (const list of itemsByQueue.values()) list.sort((a, b) => a.position - b.position);

  const blocksByWeekday = new Map<number, PlanBlockDef[]>();
  for (const b of plan.blocks) {
    const list = blocksByWeekday.get(b.weekday) ?? [];
    list.push(b);
    blocksByWeekday.set(b.weekday, list);
  }

  // Contador de posición consumida por cola: clave = queueId solo (colas
  // globales) o `${phaseId}:${queueId}` (colas por fase — una fase nueva
  // arranca en 0 automáticamente porque la clave cambia).
  const counters = new Map<string, number>();

  const out: ResolvedDay[] = [];
  let cur = plan.startDate;
  while (cur <= toDate) {
    const isHoliday = holidaySet.has(cur);
    const phase = findPhase(plan.phases, cur);
    const weekday = weekdayMon0(cur);
    const dayBlocks = blocksByWeekday.get(weekday) ?? [];

    const blocksByPerson: Record<string, ResolvedBlock[]> = {};
    if (cur >= fromDate) {
      for (const p of plan.people) blocksByPerson[p.id] = [];
    }

    for (const b of dayBlocks) {
      let text = b.text;
      let resolvedAsHoliday = false;

      if (isHoliday && b.holidayText) {
        text = b.holidayText;
        resolvedAsHoliday = true;
        // No avanza el contador (regla 3).
      } else if (b.queueId) {
        const queue = queueById.get(b.queueId);
        if (queue) {
          const counterKey = queue.global ? queue.id : `${phase?.id ?? ""}:${queue.id}`;
          const items = (itemsByQueue.get(queue.id) ?? []).filter((it) =>
            queue.global ? it.phaseId === null : it.phaseId === (phase?.id ?? null),
          );
          const idx = counters.get(counterKey) ?? 0;

          if (items.length === 0) {
            text = queue.fallback ?? b.text;
          } else if (queue.cyclic) {
            text = items[idx % items.length].text;
            counters.set(counterKey, idx + 1);
          } else if (idx < items.length) {
            text = items[idx].text;
            counters.set(counterKey, idx + 1);
          } else {
            text = queue.fallback ?? b.text;
            counters.set(counterKey, idx + 1);
          }
        }
      }

      // Overrides, después de avanzar el contador (regla 5).
      const override = plan.overrides.find((o) => o.date === cur && o.blockId === b.id);
      if (override?.removed) continue;
      if (override?.text != null) text = override.text;

      let startTime = b.startTime;
      let endTime = b.endTime;
      if (override?.startTime) {
        startTime = override.startTime;
        endTime = override.durationMinutes != null ? addMinutes(startTime, override.durationMinutes) : null;
      }

      if (cur >= fromDate) {
        blocksByPerson[b.personId]!.push({
          blockId: b.id,
          personId: b.personId,
          startTime,
          endTime,
          text,
          kind: b.kind,
          tentative: b.tentative,
          isMinimum: b.isMinimum,
          isHoliday: resolvedAsHoliday,
        });
      }
    }

    if (cur >= fromDate) {
      const events = plan.events
        .filter((e) => e.date === cur || (e.monthDay != null && e.monthDay === Number(cur.slice(8, 10))))
        .map((e) => ({
          eventId: e.id,
          personId: e.personId,
          startTime: e.startTime,
          endTime: e.endTime,
          text: e.text,
          kind: e.kind,
        }))
        .sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));

      for (const list of Object.values(blocksByPerson)) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

      out.push({ date: cur, phase, isHoliday, blocksByPerson, events });
    }

    cur = addDaysISO(cur, 1);
  }

  return out;
}
