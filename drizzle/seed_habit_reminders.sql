-- Seed manual (NO es una migración numerada de drizzle-kit, no la corra
-- db:migrate — aplicar a mano después de 0046_lethal_triton.sql):
-- vincula los hábitos de comida con su recordatorio de dientes.
-- Correlaciona por nombre + mismo user_id (asume nombres únicos por
-- usuario, mismo criterio que scripts/seed-*.ts) — re-ejecutable sin
-- duplicar nada.

UPDATE activities AS a
SET reminder_activity_id = t.id,
    reminder_text = '🪥 Lávate los dientes'
FROM activities AS t
WHERE a.name = 'Desayunar'
  AND t.name = 'Dientes mañana'
  AND t.user_id = a.user_id;

UPDATE activities AS a
SET reminder_activity_id = t.id,
    reminder_text = '🪥 Lávate los dientes'
FROM activities AS t
WHERE a.name = 'Almorzar'
  AND t.name = 'Dientes tarde'
  AND t.user_id = a.user_id;

UPDATE activities AS a
SET reminder_activity_id = t.id,
    reminder_text = '🪥 Lávate los dientes'
FROM activities AS t
WHERE a.name = 'Cenar'
  AND t.name = 'Dientes noche'
  AND t.user_id = a.user_id;

UPDATE activities
SET hora_sugerida = '07:00'
WHERE name = 'Dientes mañana';
