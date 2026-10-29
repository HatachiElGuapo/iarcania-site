// Resolver puro de Plan: recibe el plan completo (ya cargado de la base, sin
// más queries acá dentro) y un rango de fechas, y devuelve día por día la
// fase activa, si es festivo, y los bloques/eventos resueltos.
//
// Reglas (docs/plan/plan-iarcania-spec.md § Resolver), en este orden:
//  1. Bloques del día = plan_blocks de ese weekday (0=lunes…6=domingo).
//  2. Festivo + el bloque tiene holidayText → usa ese texto, no avanza la
//     posición de su cola.
//  3. Bloque con cola → posición actual por (fase, cola), o solo por cola
//     si es global, arrancando en plan.queueCursors (NO se cuenta desde
//     plan.startDate — la cola solo avanza cuando se marca una actividad,
//     ver setCheck en actions.ts). Dentro de UNA misma llamada a
//     resolvePlan, cada ocurrencia posterior de esa cola avanza una
//     posición en memoria — así el día de HOY depende del cursor real
//     persistido, pero días futuros en el mismo rango se ven como
//     "proyección" (cursor+1, cursor+2…) sin tocar la base. Cíclica
//     vuelve a empezar; no cíclica usa el fallback una vez agotada.
//  4. plan_overrides con deferredQueueItem=true (ver "Mover" en
//     actions.ts) saltan la ocurrencia ANTES de tocar la posición — no
//     cuenta como consumida, para que el mismo item reaparezca entero en
//     la fecha elegida. Los demás overrides (removed=true normal, o
//     cambio de texto) se aplican DESPUÉS de avanzar la posición.
//  5. Eventos del día (por fecha o por month_day), ordenados por hora.
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
  // true solo en overrides creados por "Mover" (mañana/elegir fecha): la
  // ocurrencia se oculta SIN consumir la posición de la cola — ver regla 4
  // arriba. false (removeForDay, drag en Agenda, cambio de texto) sigue
  // avanzando la cola normal.
  deferredQueueItem: boolean;
  // startTime no nulo = se movió (ej. arrastrado en Agenda) solo para ese
  // día. durationMinutes es la duración original del bloque — null si el
  // bloque es abierto (ej. Dormir), para que siga abierto en el horario
  // nuevo.
  startTime: string | null;
  durationMinutes: number | null;
};

// Posición actual persistida de una cola (o cola+fase) — punto de partida
// del resolver, no algo que él mismo calcule. Sin fila para un grupo =
// posición 0.
export type PlanQueueCursor = {
  queueId: string;
  phaseId: string | null;
  position: number;
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
  queueCursors: PlanQueueCursor[];
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
  // true = este texto es una PROYECCIÓN (cursor+1, +2… dentro del mismo
  // rango resuelto) — no la posición real persistida todavía. Pasa en
  // vistas de varios días (Agenda, semana): solo la primera ocurrencia de
  // cada cola dentro del rango usa el cursor real, el resto proyecta hacia
  // adelante sin tocar la base. Si se marca (hecho/saltado) un bloque
  // proyectado, la cola avanza igual — pero la proyección mostrada en ESE
  // momento puede no coincidir con lo que se vea después si se mueve o
  // marca algo antes en el camino.
  isProjected: boolean;
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

// `today` separa pasado de futuro dentro del rango resuelto — default
// fromDate, es decir "todo el rango es pasado/presente, nunca proyectes"
// (lo que ya hacían los únicos llamadores que SÍ usan el texto resuelto de
// más de un día: la vista de un solo día, donde fromDate=toDate=today de
// cualquier forma). Días < today usan la posición real SIN avanzarla —
// nunca se marcaron, así que el cursor real nunca se movió de ahí (regla
// de "solo avanza al marcar"): mismo item en todos. Días >= today son la
// proyección: today ancla la posición real, lo que sigue avanza en
// memoria (cursor+1, +2…) como si se marcara cada ocurrencia en orden —
// una previsualización, nunca se persiste nada.
export function resolvePlan(plan: PlanData, fromDate: string, toDate: string, today: string = fromDate): ResolvedDay[] {
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

  // Posición por cola: clave = queueId solo (colas globales) o
  // `${phaseId}:${queueId}` (colas por fase). Arranca en lo persistido en
  // plan.queueCursors (0 si no hay fila) — NO se recalcula contando desde
  // plan.startDate, por eso el loop de abajo arranca directo en fromDate.
  const counters = new Map<string, number>();
  for (const c of plan.queueCursors) {
    const key = c.phaseId == null ? c.queueId : `${c.phaseId}:${c.queueId}`;
    counters.set(key, c.position);
  }
  // Marca qué (fase, cola) ya tuvo su primera ocurrencia dentro de este
  // rango — esa usa la posición real; las siguientes dentro del mismo
  // rango son proyección (cursor+1, +2…) sin persistir nada.
  const seenInRange = new Set<string>();

  const out: ResolvedDay[] = [];
  let cur = fromDate;
  while (cur <= toDate) {
    const isHoliday = holidaySet.has(cur);
    const phase = findPhase(plan.phases, cur);
    const weekday = weekdayMon0(cur);
    const dayBlocks = blocksByWeekday.get(weekday) ?? [];

    const blocksByPerson: Record<string, ResolvedBlock[]> = {};
    for (const p of plan.people) blocksByPerson[p.id] = [];

    for (const b of dayBlocks) {
      let text = b.text;
      let resolvedAsHoliday = false;
      let isProjected = false;

      // Override de "Mover" (regla 4): salta la ocurrencia ANTES de
      // tocar la posición de la cola — no cuenta como consumida.
      const override = plan.overrides.find((o) => o.date === cur && o.blockId === b.id);
      if (override?.removed && override.deferredQueueItem) continue;

      if (isHoliday && b.holidayText) {
        text = b.holidayText;
        resolvedAsHoliday = true;
        // No avanza la posición (regla 2).
      } else if (b.queueId) {
        const queue = queueById.get(b.queueId);
        if (queue) {
          const counterKey = queue.global ? queue.id : `${phase?.id ?? ""}:${queue.id}`;
          const items = (itemsByQueue.get(queue.id) ?? []).filter((it) =>
            queue.global ? it.phaseId === null : it.phaseId === (phase?.id ?? null),
          );
          const idx = counters.get(counterKey) ?? 0;
          const canAdvance = cur >= today; // regla arriba: pasado nunca avanza
          isProjected = canAdvance && seenInRange.has(counterKey);
          if (canAdvance) seenInRange.add(counterKey);

          if (items.length === 0) {
            text = queue.fallback ?? b.text;
          } else if (queue.cyclic) {
            text = items[idx % items.length].text;
            if (canAdvance) counters.set(counterKey, idx + 1);
          } else if (idx < items.length) {
            text = items[idx].text;
            if (canAdvance) counters.set(counterKey, idx + 1);
          } else {
            text = queue.fallback ?? b.text;
            if (canAdvance) counters.set(counterKey, idx + 1);
          }
        }
      }

      // Otros overrides (remover de verdad, cambio de texto), después de
      // avanzar la posición (regla 4).
      if (override?.removed) continue;
      if (override?.text != null) text = override.text;

      let startTime = b.startTime;
      let endTime = b.endTime;
      if (override?.startTime) {
        startTime = override.startTime;
        endTime = override.durationMinutes != null ? addMinutes(startTime, override.durationMinutes) : null;
      }

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
        isProjected,
      });
    }

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

    cur = addDaysISO(cur, 1);
  }

  return out;
}
