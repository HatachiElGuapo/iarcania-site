import type { ReactNode } from "react";
import { Button } from "./button";

// 5d — «Sin resultados» de una lista larga: la búsqueda o los filtros no
// devolvieron nada, pero SÍ hay datos. Nombra el término y el filtro activo
// y ofrece deshacerlos. Distinto de <EmptyState> (sección vacía de verdad).
export function NoResults({
  query,
  context,
  clearHref,
  scopeHref,
}: {
  /** El término buscado, sin comillas (se agregan aquí). */
  query?: string;
  /** Frase que describe el filtro activo, p. ej. `en la relación «Cliente»`. */
  context?: ReactNode;
  /** Ruta que limpia todos los filtros. */
  clearHref: string;
  /** Ruta a una búsqueda más amplia ("Buscar en todo"), si aplica. */
  scopeHref?: string;
}) {
  return (
    <div className="rounded-ui-lg border border-dashed border-line bg-canvas px-4 py-8 text-center">
      <div className="text-[17px]">⌕</div>
      <p className="mx-auto mt-2 max-w-[42ch] text-body leading-relaxed text-ink-muted">
        Nada coincide con {query ? <>«{query}»</> : "los filtros activos"}
        {context ? <> {context}</> : null}.
      </p>
      <div className="mt-3 inline-flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" href={clearHref}>
          Quitar filtros
        </Button>
        {scopeHref && (
          <Button variant="ghost" size="sm" href={scopeHref}>
            Buscar en todo
          </Button>
        )}
      </div>
    </div>
  );
}
