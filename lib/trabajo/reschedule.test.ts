// node --import tsx --test lib/trabajo/reschedule.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withOriginalDateNote } from "./reschedule";

test("tarea con fecha, sin notas → agrega la línea sola", () => {
  assert.equal(withOriginalDateNote(null, "2026-10-01"), "Fecha original: 2026-10-01");
});

test("tarea con fecha y notas previas → agrega la línea al final", () => {
  assert.equal(withOriginalDateNote("llamar antes de las 5", "2026-10-01"), "llamar antes de las 5\nFecha original: 2026-10-01");
});

test("tarea sin fecha (ya estaba en backlog) → no agrega nada", () => {
  assert.equal(withOriginalDateNote("una nota", null), "una nota");
  assert.equal(withOriginalDateNote(null, null), null);
});

test("ya tiene 'Fecha original:' guardada → no la pisa en un segundo reagendado", () => {
  const notes = "una nota\nFecha original: 2026-09-15";
  assert.equal(withOriginalDateNote(notes, "2026-10-01"), notes);
});
