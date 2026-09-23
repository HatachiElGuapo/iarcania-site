-- 011_brands_tono_de_voz.sql
-- Agrega la columna tono_de_voz a brands (no venía en 008).
-- Texto libre: cómo suena la marca, usado como contexto para la IA.
-- Correr en la MISMA base donde viva `brands`.

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tono_de_voz text;

-- Opcional — sembrar un valor inicial por marca (edítalos a gusto):
UPDATE public.brands
   SET tono_de_voz = 'Directo, sin hype. Muestra cosas reales y funcionales. Primera persona.'
 WHERE lower(replace(nombre,'_','')) = 'iarcania' AND tono_de_voz IS NULL;

UPDATE public.brands
   SET tono_de_voz = 'Introspectivo, honesto, sin motivación vacía. Habla desde experiencia propia.'
 WHERE lower(replace(nombre,'_','')) = 'voidstoic' AND tono_de_voz IS NULL;
