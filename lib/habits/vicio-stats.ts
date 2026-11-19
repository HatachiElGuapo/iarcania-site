import { diffDaysISO } from "@/lib/date/bogota";

export type VicioStats = { daysSinceLast: number | null; bestStreak: number; lastDate: string | null };

// A partir de las fechas (YYYY-MM-DD, pueden repetirse — un vicio puede
// registrarse varias veces el mismo día) donde hubo al menos un registro:
// hace cuántos días fue el último, la racha más larga de días
// consecutivos CON registro, y la fecha del último. Sin tabla nueva — se
// computa en memoria desde activity_logs.
export function computeVicioStats(dates: string[], today: string): VicioStats {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return { daysSinceLast: null, bestStreak: 0, lastDate: null };

  const lastDate = sorted[sorted.length - 1];
  const daysSinceLast = diffDaysISO(lastDate, today);

  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (diffDaysISO(sorted[i - 1], sorted[i]) === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }

  return { daysSinceLast, bestStreak: best, lastDate };
}
