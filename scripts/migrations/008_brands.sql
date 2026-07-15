-- 008_brands.sql
-- Crea tabla brands + columna config + filas IArcanIA y Void Stoic
-- Ejecutado 2026-07-15 en Supabase gpfidxx

CREATE TABLE IF NOT EXISTS public.brands (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  colores     jsonb,
  tipografia  text,
  logo_url    text,
  config      jsonb,
  created_at  timestamptz not null default now()
);
