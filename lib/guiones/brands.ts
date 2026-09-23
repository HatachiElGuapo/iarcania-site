// Servidor únicamente (importa `db`). No importar desde componentes cliente
// — usar los tipos/utilidades puros de ./brand-theme.ts en su lugar.
import { db } from "@/lib/db/client";
import { brands } from "@/lib/db/schema/brands";
import {
  DEFAULT_THEMES,
  defaultTheme,
  normCanal,
  type BrandTheme,
} from "./brand-theme";

// Opción A del plan: NO se agrega `scripts.brand_id`. El vínculo guión↔marca
// es por `scripts.canal` ('iarcania'|'voidstoic') → fila de `brands` cuyo
// `nombre` normalizado coincide (la tabla usa 'iarcania' y 'void_stoic'; se
// normaliza quitando espacios/guiones/underscores).

type BrandRow = typeof brands.$inferSelect;

function mergeTheme(canal: string, row: BrandRow | undefined): BrandTheme {
  const d = defaultTheme(canal);
  if (!row) return d;
  const c = row.colores ?? {};
  return {
    id: typeof row.id === "number" ? row.id : null,
    nombre: row.nombre || d.nombre,
    canal: normCanal(canal),
    fondo: c.fondo || d.fondo,
    primario: c.primario || d.primario,
    texto: c.texto || d.texto,
    acento: c.acento || d.acento,
    tipografia: row.tipografia ?? null,
    logoUrl: row.logoUrl ?? null,
  };
}

// La tabla `brands` puede no existir todavía en esta DB (viene de la base de
// guiones original — ver NOTES.md). Si el SELECT falla, se degrada a los
// defaults en vez de tumbar la página.
async function fetchBrandRows(): Promise<BrandRow[]> {
  try {
    return await db.select().from(brands);
  } catch {
    return [];
  }
}

export async function brandThemeForCanal(canal: string): Promise<BrandTheme> {
  const rows = await fetchBrandRows();
  const row = rows.find((r) => normCanal(r.nombre) === normCanal(canal));
  return mergeTheme(canal, row);
}

export async function allBrandThemes(): Promise<Record<string, BrandTheme>> {
  const rows = await fetchBrandRows();
  const out: Record<string, BrandTheme> = {};
  for (const canal of Object.keys(DEFAULT_THEMES)) {
    const row = rows.find((r) => normCanal(r.nombre) === normCanal(canal));
    out[canal] = mergeTheme(canal, row);
  }
  return out;
}

export async function tonoDeVozForCanal(canal: string): Promise<string | null> {
  const rows = await fetchBrandRows();
  const row = rows.find((r) => normCanal(r.nombre) === normCanal(canal));
  return row?.tonoDeVoz ?? null;
}
