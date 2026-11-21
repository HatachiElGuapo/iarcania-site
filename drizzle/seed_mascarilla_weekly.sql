-- Seed manual (NO es una migración numerada de drizzle-kit — aplicar a
-- mano después de 0047_early_maggott.sql): marca "Mascarilla" como hábito
-- no diario, 2 veces por semana.
UPDATE activities SET weekly_target = 2 WHERE name = 'Mascarilla';
