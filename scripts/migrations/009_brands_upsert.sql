-- 009_brands_upsert.sql
-- Fuente de verdad de marcas IArcanIA y Void Stoic.
-- Ejecutar en Supabase gpfidxx (base de guiones/scripts).
-- Usa UPSERT: actualiza colores + config visual pero conserva
-- logo_svg, copy_perfil, copy_estructura (|| merge jsonb).
-- 2026-07-15

-- ─── IArcanIA ────────────────────────────────────────────────
INSERT INTO public.brands (nombre, colores, config)
VALUES (
  'iarcania',
  '{"fondo":"#090910","primario":"#7c3aed","texto":"#f1f0f7","acento":"#d4af37"}',
  '{
    "dark_mode":true,
    "font_cuerpo":"Inter",
    "font_titulo":"Playfair Display",
    "google_fonts_url":"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap",
    "card_bg":"#13131f",
    "card_border":"rgba(168,85,247,0.15)",
    "card_top":"linear-gradient(90deg,#7c3aed,#d4af37)",
    "sep":"linear-gradient(90deg,transparent,#d4af37,transparent)",
    "sep2":"linear-gradient(90deg,transparent,#7c3aed,transparent)",
    "gradient_text":"linear-gradient(135deg,#7c3aed 0%,#d4af37 100%)",
    "section_label_color":"#d4af37",
    "orb_1_color":"#7c3aed",
    "orb_2_color":"#d4af37",
    "scrollbar_color":"#7c3aed",
    "nombre_canal":"IArcanIA"
  }'::jsonb
)
ON CONFLICT (nombre) DO UPDATE SET
  colores = EXCLUDED.colores,
  -- || merge: conserva logo_svg, copy_perfil, copy_estructura existentes
  config  = public.brands.config || EXCLUDED.config;

-- ─── Void Stoic ──────────────────────────────────────────────
INSERT INTO public.brands (nombre, colores, config)
VALUES (
  'void_stoic',
  '{"fondo":"#f7f5ef","primario":"#5b9bd5","texto":"#3d5372","acento":"#e8d9b5"}',
  '{
    "dark_mode":false,
    "font_cuerpo":"Inter",
    "font_titulo":"Playfair Display",
    "google_fonts_url":"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap",
    "card_bg":"#eef0ea",
    "card_border":"rgba(91,155,213,0.2)",
    "card_top":"linear-gradient(90deg,#5b9bd5,#3d5372)",
    "sep":"linear-gradient(90deg,transparent,#5b9bd5,transparent)",
    "sep2":"linear-gradient(90deg,transparent,#3d5372,transparent)",
    "gradient_text":"linear-gradient(135deg,#5b9bd5 0%,#3d5372 100%)",
    "section_label_color":"#5b9bd5",
    "orb_1_color":"#5b9bd5",
    "orb_2_color":"#e8d9b5",
    "scrollbar_color":"#5b9bd5",
    "nombre_canal":"Void Stoic"
  }'::jsonb
)
ON CONFLICT (nombre) DO UPDATE SET
  colores = EXCLUDED.colores,
  config  = public.brands.config || EXCLUDED.config;
