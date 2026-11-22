-- Limpieza manual (NO es una migración numerada de drizzle-kit, no la
-- corra db:migrate) — borra los plan_checks que quedaron en un bloque
-- cuyo weekday NO corresponde al weekday real de la fecha del check.
-- Bug: applyHabitToggle (app/dashboard/plan/actions.ts) escribía el
-- plan_check en TODOS los plan_blocks enlazados a la activity marcada,
-- sin filtrar por weekday — un hábito enlazado a un bloque por día de la
-- semana (ej. "Secundarios pendientes", weekday 0..6) terminaba con
-- checks en los 7. Ya arreglado (fixed commit) — esto es solo para
-- borrar los datos que quedaron mal de antes.
--
-- weekdayMon0(fecha) en SQL: (EXTRACT(DOW FROM fecha)::int + 6) % 7
-- (Postgres EXTRACT(DOW) es 0=domingo; la app usa 0=lunes).
--
-- 1) Previsualizar antes de borrar:
SELECT
  pc.date,
  pc.block_id,
  pb.weekday AS block_weekday,
  pb.text AS block_text,
  (EXTRACT(DOW FROM pc.date)::int + 6) % 7 AS date_weekday_mon0
FROM plan_checks pc
JOIN plan_blocks pb ON pb.id = pc.block_id
WHERE pb.weekday <> (EXTRACT(DOW FROM pc.date)::int + 6) % 7
ORDER BY pc.date, pb.text;

-- 2) Borrar esos plan_checks (correr a mano, después de revisar el preview):
-- DELETE FROM plan_checks pc
-- USING plan_blocks pb
-- WHERE pb.id = pc.block_id
--   AND pb.weekday <> (EXTRACT(DOW FROM pc.date)::int + 6) % 7;
