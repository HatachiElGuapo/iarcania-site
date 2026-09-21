// node --import tsx --test lib/plan/resolve.test.ts
//
// Construye el PlanData directamente desde docs/plan/plan-seed.json (mismo
// mapeo que scripts/seed-plan.ts, pero en memoria, sin tocar la base) para
// probar el resolver contra los datos reales, no un fixture inventado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolvePlan, computeQueueProgress, type PlanData } from "./resolve";

const WEEKDAY_KEYS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;

type SeedBlock = {
  id: string;
  t: string;
  e: string | null;
  x: string;
  k: string;
  q?: string;
  hx?: string;
  min?: boolean;
  p?: boolean;
};
type SeedPerson = { id: string; name: string; days: Record<string, SeedBlock[]> };
type SeedQueue = { n: string; cyc: boolean; fb?: string; glob?: boolean; items?: string[] };
type SeedPhase = { id: string; n: string; a: string; b: string; meta?: string; q: Record<string, string[]> };
type Seed = {
  people: SeedPerson[];
  queues: Record<string, SeedQueue>;
  phases: SeedPhase[];
  hol: string[];
  events: { d?: string; m?: number; p?: string; t?: string; e?: string; x: string; k?: string }[];
  range: [string, string];
};

function loadPlanData(): PlanData {
  const seedPath = path.join(process.cwd(), "docs/plan/plan-seed.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as Seed;

  const queues = Object.entries(seed.queues).map(([key, q]) => ({
    id: key,
    key,
    name: q.n,
    cyclic: q.cyc,
    global: !!q.glob,
    fallback: q.fb ?? null,
  }));

  const queueItems: PlanData["queueItems"] = [];
  for (const [key, q] of Object.entries(seed.queues)) {
    if (q.glob && q.items) {
      q.items.forEach((text, position) => queueItems.push({ queueId: key, phaseId: null, position, text }));
    }
  }
  for (const ph of seed.phases) {
    for (const [key, items] of Object.entries(ph.q)) {
      items.forEach((text, position) => queueItems.push({ queueId: key, phaseId: ph.id, position, text }));
    }
  }

  const blocks: PlanData["blocks"] = [];
  for (const p of seed.people) {
    WEEKDAY_KEYS.forEach((dayKey, weekday) => {
      for (const b of p.days[dayKey] ?? []) {
        blocks.push({
          id: b.id,
          personId: p.id,
          weekday,
          startTime: b.t,
          endTime: b.e ?? null,
          text: b.x,
          kind: b.k,
          tentative: !!b.p,
          isMinimum: !!b.min,
          queueId: b.q ?? null,
          holidayText: b.hx ?? null,
        });
      }
    });
  }

  return {
    startDate: seed.range[0],
    endDate: seed.range[1],
    people: seed.people.map((p) => ({ id: p.id, name: p.name, color: "#000" })),
    phases: seed.phases.map((ph) => ({ id: ph.id, name: ph.n, startDate: ph.a, endDate: ph.b, goal: ph.meta ?? null })),
    queues,
    queueItems,
    blocks,
    holidays: seed.hol,
    events: seed.events.map((e, i) => ({
      id: `ev${i}`,
      personId: e.p ?? null,
      date: e.d ?? null,
      monthDay: e.m ?? null,
      startTime: e.t ?? null,
      endTime: e.e ?? null,
      text: e.x,
      kind: e.k ?? null,
    })),
    overrides: [],
  };
}

function blockAt(plan: PlanData, date: string, personId: string, startTime: string) {
  const [day] = resolvePlan(plan, date, date);
  const block = day.blocksByPerson[personId]?.find((b) => b.startTime === startTime);
  assert.ok(block, `no hay bloque de ${personId} a las ${startTime} el ${date}`);
  return block!;
}

test("2026-09-22, Miguel 10:00 → primer item de la cola build (fase 1)", () => {
  const plan = loadPlanData();
  const block = blockAt(plan, "2026-09-22", "miguel", "10:00");
  assert.equal(block.text, "Documentar en el runbook cómo clonar el Agente Base");
});

test("2026-10-12 (festivo), Miguel 08:00 → texto de festivo y el contador de prospección no avanza", () => {
  const plan = loadPlanData();
  const holiday = blockAt(plan, "2026-10-12", "miguel", "08:00");
  assert.equal(holiday.text, "Festivo: armar lista de prospectos (sin contactar)");
  assert.equal(holiday.isHoliday, true);

  // Del 2026-09-21 (lunes) al 2026-10-09 hay 15 ocurrencias del bloque de
  // "prosp" (lun-vie, sin festivos de por medio) → consumen los items 0-14
  // de la lista de 20. El 2026-10-12 es festivo y no cuenta. Si NO consumió
  // un item, el 2026-10-13 (siguiente día hábil) usa el item 15; si lo
  // hubiera consumido de más, usaría el 16.
  const next = blockAt(plan, "2026-10-13", "miguel", "08:00");
  assert.equal(
    next.text,
    "Inmobiliarias pequeñas: lista de 30 en Kennedy y Fontibón con WhatsApp y primeros 10 mensajes ofreciendo auditoría gratis",
  );
});

test("2027-01-16, Miguel 06:00 → fallback de Void Stoic (lista global agotada)", () => {
  const plan = loadPlanData();
  const block = blockAt(plan, "2027-01-16", "miguel", "06:00");
  assert.equal(block.text, "Void Stoic: guion del próximo episodio");
});

test("2026-09-21 es lunes → devuelve los bloques de la plantilla 'lun'", () => {
  const plan = loadPlanData();
  const [day] = resolvePlan(plan, "2026-09-21", "2026-09-21");
  assert.equal(day.date, "2026-09-21");
  const miguelBlocks = day.blocksByPerson.miguel;
  assert.ok(miguelBlocks.some((b) => b.startTime === "03:40" && b.text === "Despertar, cama y agua"));
  // Si el mapeo de weekday estuviera invertido (getDay()=0 es domingo, no
  // lunes), este día resolvería la plantilla de "dom" en vez de "lun" — ese
  // primer bloque de dom es distinto ("Despertar..." también pero a las
  // mismas 03:40, así que se confirma además con un bloque exclusivo de lun:
  // el bloque de Void Stoic solo corre sáb/dom, no debería aparecer hoy).
  assert.equal(
    miguelBlocks.some((b) => b.text.includes("Void Stoic")),
    false,
  );
});

test("override con startTime mueve el bloque solo ese día, conservando (o no) el final abierto", () => {
  const plan = loadPlanData();

  // b1 = Despertar, cama y agua, lun 03:40–04:00 (20 min) → se mueve a las
  // 10:00, debe seguir durando 20 min (10:00–10:20), no quedar abierto.
  const withMove = {
    ...plan,
    overrides: [{ date: "2026-09-21", blockId: "b1", text: null, removed: false, startTime: "10:00", durationMinutes: 20 }],
  };
  const moved = blockAt(withMove, "2026-09-21", "miguel", "10:00");
  assert.equal(moved.text, "Despertar, cama y agua");
  assert.equal(moved.endTime, "10:20");

  // b10 = Dormir, lun 19:40–null (abierto) → se mueve a las 22:00,
  // durationMinutes null porque el original es abierto, debe SEGUIR abierto.
  const withMoveOpen = {
    ...plan,
    overrides: [{ date: "2026-09-21", blockId: "b10", text: null, removed: false, startTime: "22:00", durationMinutes: null }],
  };
  const movedOpen = blockAt(withMoveOpen, "2026-09-21", "miguel", "22:00");
  assert.equal(movedOpen.text, "Dormir");
  assert.equal(movedOpen.endTime, null);
});

test("computeQueueProgress: 5 ocurrencias de 'build' (lun-vie) al 2026-09-25", () => {
  const plan = loadPlanData();
  const progress = computeQueueProgress(plan, "2026-09-25");
  assert.equal(progress.get("f1:build"), 5);
});

test("computeQueueProgress antes de plan.startDate da vacío", () => {
  const plan = loadPlanData();
  const progress = computeQueueProgress(plan, "2026-09-20"); // un día antes de empezar
  assert.equal(progress.size, 0);
});
