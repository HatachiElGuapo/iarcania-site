// Tipos y helpers PUROS de los secundarios (franja horaria, agrupar,
// filtrar) — separados de lib/plan/secondary.ts porque ese archivo
// importa loadHabitTreesByBlock (DB real, lib/db/client.ts) y los
// componentes "use client" que necesitan estos helpers (day-event-row.tsx,
// mobile-day-row.tsx) no pueden arrastrar ese import al bundle del
// navegador — Next no puede resolver los módulos de Node que usa `postgres`
// (fs, perf_hooks) ahí. Solo tipos y funciones sin ningún import de DB.
import type { HabitNode } from "./sub-habits";

export type SecondaryBand = "manana" | "tarde" | "noche";

export type SecondaryEntry = {
  node: HabitNode;
  dueTime: string;
  blockId: string;
  blockText: string;
  blockStartTime: string;
};

// Mañana: antes de 12:00. Tarde: 12:00–18:00. Noche: después de 18:00.
export function bandOf(hhmm: string): SecondaryBand {
  const [h] = hhmm.split(":").map(Number);
  if (h < 12) return "manana";
  if (h < 18) return "tarde";
  return "noche";
}

export function groupSecondaryEntries(entries: SecondaryEntry[]): Record<SecondaryBand, SecondaryEntry[]> {
  const groups: Record<SecondaryBand, SecondaryEntry[]> = { manana: [], tarde: [], noche: [] };
  for (const e of entries) groups[bandOf(e.dueTime)].push(e);
  (Object.keys(groups) as SecondaryBand[]).forEach((k) => groups[k].sort((a, b) => a.dueTime.localeCompare(b.dueTime)));
  return groups;
}

// Para el bloque kind='secundarios' ("Secundarios pendientes"): solo
// Mañana/Tarde, y solo los que vencen ANTES de que el bloque termine — los
// de Noche (o los de Mañana/Tarde cuya hora cae después del fin del
// bloque) no se pueden cumplir todavía a esa hora, así que no entran acá;
// siguen apareciendo en la tarjeta "Secundarios" y en Pendientes cuando
// les llegue su hora. `groups` y el resultado siguen el mismo shape para
// poder reusar SecondaryModalContent/countTotals tal cual.
export function filterSecondaryGroupsForBlock(
  groups: Record<SecondaryBand, SecondaryEntry[]>,
  blockEndTime: string,
): Record<SecondaryBand, SecondaryEntry[]> {
  return {
    manana: groups.manana.filter((e) => e.dueTime < blockEndTime),
    tarde: groups.tarde.filter((e) => e.dueTime < blockEndTime),
    noche: [],
  };
}
