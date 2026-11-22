// node --import tsx --test lib/plan/streak.test.ts
//
// Reproduce exactamente el reporte: plan.startDate = 2026-11-19, un
// is_minimum por weekday (19 jueves, 20 viernes, 21 sábado, 22 domingo —
// uno de verdad por día, nunca "todos los bloques del plan" sin filtrar),
// done el 19/20/21, el 22 (hoy) todavía sin marcar → racha esperada = 3,
// sin que el día de hoy en curso cuente como fallo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePlan, type PlanData } from "./resolve";
import { deriveDayCompletions, excludeTodayInProgress, simulateStreak } from "./streak-pure";

const PERSON_ID = "p1";
const START_DATE = "2026-11-19"; // jueves (weekdayMon0 = 3)
const TODAY = "2026-11-22"; // domingo (weekdayMon0 = 6), todavía sin marcar

function block(id: string, weekday: number): PlanData["blocks"][number] {
  return {
    id,
    personId: PERSON_ID,
    weekday,
    startTime: "08:00",
    endTime: "09:00",
    text: `TEST mínimo weekday ${weekday}`,
    kind: "rutina",
    tentative: false,
    isMinimum: true,
    queueId: null,
    holidayText: null,
    flexible: false,
    createdAt: "2000-01-01",
  };
}

function buildPlanData(): PlanData {
  return {
    startDate: START_DATE,
    endDate: "2099-12-31",
    people: [{ id: PERSON_ID, name: "Test", color: "#000000" }],
    phases: [],
    queues: [],
    queueItems: [],
    queueCursors: [],
    // Un bloque is_minimum por weekday de 19 (jueves=3) a 22 (domingo=6) —
    // nunca el mismo bloque repetido para los 4 días.
    blocks: [block("b19", 3), block("b20", 4), block("b21", 5), block("b22", 6)],
    holidays: [],
    events: [],
    overrides: [],
  };
}

test("3 días completos + hoy (domingo) sin marcar → racha 3, hoy no cuenta como fallo", () => {
  const planData = buildPlanData();
  const resolved = resolvePlan(planData, START_DATE, TODAY, TODAY);
  assert.equal(resolved.length, 4);

  // Solo 19/20/21 marcados "done" — 22 (hoy) sin ningún plan_check,
  // igual que lo reportado ("el 22 aún no").
  const doneSet = new Set(["2026-11-19:b19", "2026-11-20:b20", "2026-11-21:b21"]);

  const completions = excludeTodayInProgress(deriveDayCompletions(resolved, PERSON_ID, doneSet), TODAY, TODAY);
  const result = simulateStreak(completions);

  assert.equal(result.streak, 3);
  assert.equal(result.best, 3);
});

test("un plan_check colgado en el bloque de OTRO weekday no se cuenta", () => {
  const planData = buildPlanData();
  const resolved = resolvePlan(planData, START_DATE, TODAY, TODAY);

  // "Residuo" del bug anterior: un done en b20 (viernes) fechado el 19
  // (jueves) — no es el bloque que resolvePlan asigna al 19, así que no
  // debe contar como si el 19 estuviera cumplido.
  const doneSet = new Set(["2026-11-19:b20", "2026-11-20:b20", "2026-11-21:b21"]);

  const completions = excludeTodayInProgress(deriveDayCompletions(resolved, PERSON_ID, doneSet), TODAY, TODAY);
  const result = simulateStreak(completions);

  // El 19 no cuenta como hecho (fallo #1, no rompe sola); 20 y 21 sí; hoy
  // (22) en curso no cuenta como fallo — la racha queda en 2 (20 y 21).
  assert.equal(result.streak, 2);
});
