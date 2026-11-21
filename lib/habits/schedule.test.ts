// node --import tsx --test lib/habits/schedule.test.ts
//
// Corrección de convención: plan_blocks.weekday en producción resultó ser
// 0=domingo (EXTRACT(DOW) de Postgres), no Mon-0 como asume el resolver de
// Plan (ver lib/plan/resolve.ts) — activities.dias_semana sigue siendo
// 0=lunes (el selector "Días" del menú ⋯ es L M M J V S D), pero calculado
// SIEMPRE con su propia conversión weekdayMon0() desde la fecha, nunca a
// partir de plan_blocks.weekday ni de ningún valor ya resuelto por Plan —
// estos tests fijan esa conversión con fechas reales conocidas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekdayMon0 } from "@/lib/date/bogota";
import { isScheduledOnDate } from "./schedule";

// 2026-11-23 es lunes (mismo ancla que lib/habitos/streak.test.ts).
test("weekdayMon0: sábado 2026-11-21 → índice 5", () => {
  assert.equal(weekdayMon0("2026-11-21"), 5);
});

test("weekdayMon0: domingo 2026-11-22 → índice 6", () => {
  assert.equal(weekdayMon0("2026-11-22"), 6);
});

test("weekdayMon0: lunes 2026-11-23 → índice 0", () => {
  assert.equal(weekdayMon0("2026-11-23"), 0);
});

test("dias_semana {2,6} (miércoles y domingo): aparece esos días, no el sábado", () => {
  const diasSemana = [2, 6];
  assert.equal(isScheduledOnDate(diasSemana, "2026-11-18"), true); // miércoles
  assert.equal(isScheduledOnDate(diasSemana, "2026-11-22"), true); // domingo
  assert.equal(isScheduledOnDate(diasSemana, "2026-11-21"), false); // sábado
});
