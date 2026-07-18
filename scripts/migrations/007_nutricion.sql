-- =====================================================================
--  Migración 007 · Tabla meals · Nutrición
--  IArcanIA Family OS · Supabase · 2026-07-18
--  IDs en texto (patrón del proyecto). Sin FK duras (patrón defensivo).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.meals (
  id          text PRIMARY KEY,
  user_id     text NOT NULL DEFAULT 'u1',
  date        date NOT NULL,
  meal_type   text NOT NULL DEFAULT 'extra',  -- desayuno | almuerzo | cena | snack
  description text,
  location    text NOT NULL DEFAULT 'casa',   -- casa | fuera
  calories    integer,
  protein_g   numeric(6,1),
  carbs_g     numeric(6,1),
  fat_g       numeric(6,1),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meals_location_chk CHECK (location IN ('casa', 'fuera')),
  CONSTRAINT meals_type_chk     CHECK (meal_type IN ('desayuno','almuerzo','cena','snack'))
);

CREATE INDEX IF NOT EXISTS meals_user_date_idx ON public.meals (user_id, date);

-- Metas diarias de macros (una fila por usuario)
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  user_id     text PRIMARY KEY,
  kcal_target integer DEFAULT 2000,
  prot_target numeric(6,1) DEFAULT 150,
  carb_target numeric(6,1) DEFAULT 200,
  fat_target  numeric(6,1) DEFAULT 65,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Metas por defecto para u1
INSERT INTO public.nutrition_targets (user_id, kcal_target, prot_target, carb_target, fat_target)
VALUES ('u1', 2000, 150, 200, 65)
ON CONFLICT (user_id) DO NOTHING;
