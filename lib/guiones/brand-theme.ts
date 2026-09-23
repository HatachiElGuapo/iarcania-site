// Tema de marca resuelto — lo que consume el editor branded, las miniaturas
// y el presentador. Sin imports de servidor: se puede usar en componentes
// cliente. La resolución real contra la tabla `brands` vive en ./brands.ts
// (servidor); aquí van solo el tipo, los defaults y utilidades de color.

export type BrandTheme = {
  id: number | null;
  nombre: string;
  canal: string; // 'iarcania' | 'voidstoic'
  fondo: string;
  primario: string;
  texto: string;
  acento: string;
  tipografia: string | null;
  logoUrl: string | null;
};

// Fallback cuando no hay fila en `brands` o le falta un color. Mismo criterio
// que os.js applyScriptBranding() (que también caía a valores por defecto).
export const DEFAULT_THEMES: Record<string, BrandTheme> = {
  iarcania: {
    id: null,
    nombre: "IArcanIA",
    canal: "iarcania",
    fondo: "#0A0A0A",
    primario: "#7C3AED",
    texto: "#FFFFFF",
    acento: "#22D3EE",
    tipografia: null,
    logoUrl: null,
  },
  voidstoic: {
    id: null,
    nombre: "Void Stoic",
    canal: "voidstoic",
    fondo: "#FFFFFF",
    primario: "#1D4ED8",
    texto: "#0F172A",
    acento: "#64748B",
    tipografia: null,
    logoUrl: null,
  },
};

export function normCanal(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[\s_-]+/g, "");
}

export function defaultTheme(canal: string): BrandTheme {
  return DEFAULT_THEMES[normCanal(canal)] ?? DEFAULT_THEMES.iarcania;
}

export function hexToRgba(hex: string, a: number): string {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return `rgba(128,128,128,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function isDark(hex: string): boolean {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.5;
}

// Superficie ligeramente distinta del fondo (para inputs / paneles internos).
export function surfaceOf(theme: BrandTheme): string {
  return hexToRgba(theme.primario, isDark(theme.fondo) ? 0.1 : 0.06);
}

// Vars CSS que el editor branded expone a sus hijos.
export function themeCssVars(theme: BrandTheme): Record<string, string> {
  return {
    "--brand-fondo": theme.fondo,
    "--brand-primario": theme.primario,
    "--brand-texto": theme.texto,
    "--brand-acento": theme.acento,
    "--brand-surface": surfaceOf(theme),
    "--brand-border": hexToRgba(theme.primario, 0.3),
  } as Record<string, string>;
}
