// Función pura, sin acceso a la base — separada de actions.ts para poder
// testearla sin arrastrar el import de @/lib/db/client (que revienta sin
// DATABASE_URL al cargar el módulo).

// Guarda "Fecha original: AAAA-MM-DD" en notes al reagendar una tarea —
// mismo formato que el script del servidor. Si ya hay una línea "Fecha
// original:" no la pisa (una tarea movida varias veces sigue mostrando la
// primera fecha real); si la tarea no tenía fecha, no hay nada que
// preservar.
export function withOriginalDateNote(notes: string | null, originalDueDate: string | null): string | null {
  const trimmed = (notes ?? "").trim();
  if (trimmed.includes("Fecha original:")) return notes;
  if (!originalDueDate) return notes;
  const line = `Fecha original: ${originalDueDate}`;
  return trimmed ? `${trimmed}\n${line}` : line;
}
