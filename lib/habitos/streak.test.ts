// node --import tsx --test lib/habitos/streak.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeeklyStreak } from "./streak";

// 2026-11-23 es lunes.
const MONDAY = "2026-11-23";

test("semana en curso sin llegar a la meta: no rompe la racha de semanas pasadas", () => {
  const logs = [
    // semana pasada (16–22 nov): 2 marcas, cumple meta 2.
    "2026-11-16",
    "2026-11-18",
    // semana actual: 1 sola marca, todavía no llega a 2.
    "2026-11-24",
  ];
  const { countThisWeek, streakWeeks } = computeWeeklyStreak(logs, 2, MONDAY);
  assert.equal(countThisWeek, 1);
  assert.equal(streakWeeks, 1);
});

test("semana en curso ya cumplida: cuenta y sigue la racha hacia atrás", () => {
  const logs = ["2026-11-16", "2026-11-18", "2026-11-23", "2026-11-25"];
  const { countThisWeek, streakWeeks } = computeWeeklyStreak(logs, 2, MONDAY);
  assert.equal(countThisWeek, 2);
  assert.equal(streakWeeks, 2);
});

test("una semana sin cumplir la meta corta la racha ahí", () => {
  const logs = [
    "2026-11-02", // semana de hace 3 (incompleta, 1 sola marca)
    "2026-11-09",
    "2026-11-11", // semana de hace 2: cumple
    "2026-11-16",
    "2026-11-18", // semana pasada: cumple
  ];
  const { streakWeeks } = computeWeeklyStreak(logs, 2, MONDAY);
  assert.equal(streakWeeks, 2);
});
