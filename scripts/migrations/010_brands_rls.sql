-- 010_brands_rls.sql
-- Habilita lectura pública en brands (datos de branding, no sensibles).
-- Sin esta policy, RLS bloquea todos los SELECT del anon key → allBrands = [].
-- Ejecutar en Supabase gpfidxx.
-- 2026-07-15

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario (anon o autenticado) puede leer las marcas
CREATE POLICY IF NOT EXISTS "brands_select_public"
  ON public.brands
  FOR SELECT
  USING (true);
