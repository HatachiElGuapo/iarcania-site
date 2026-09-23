// Posición de una actividad "trabajo" dentro de su lista de items — a
// diferencia de las colas de Plan (que avanzan por calendario), acá avanza
// según cuántas veces se marcó CUMPLIDA la actividad (activity_logs), no
// según cuántos días pasaron. Si un día no se cumple, el mismo item sigue
// esperando al día siguiente.
export function currentWorkItem<T>(items: T[], doneCount: number): T | null {
  if (!items.length) return null;
  return items[doneCount % items.length];
}
