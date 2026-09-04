import { cx } from "./cx";

// 5d — paginación de lista larga. Vive pegada al pie de la card de la lista
// (borde superior compartido). Página y tamaño en searchParams; `hrefFor`
// construye el enlace de cada página conservando el resto de filtros.
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const hi = Math.min(pages, Math.max(5, page + 2));
  const lo = Math.max(1, hi - 4);
  const nums: number[] = [];
  for (let p = lo; p <= hi; p++) nums.push(p);

  const cell = "border-l border-line px-2.5 py-1 transition-colors duration-120";

  return (
    <div className="flex items-center gap-2.5 border border-t-0 border-line bg-surface-sunken px-3.5 py-2.5 text-[11px] text-ink-dim">
      <span>
        {from}–{to} de {total}
      </span>
      <nav className="ml-auto flex items-stretch overflow-hidden rounded-ui border border-line text-[11.5px]">
        {page > 1 ? (
          <a href={hrefFor(page - 1)} className={cx(cell, "border-l-0 text-ink-muted hover:text-ink")}>
            ‹
          </a>
        ) : (
          <span className={cx(cell, "border-l-0 text-line-strong")}>‹</span>
        )}
        {nums.map((p) =>
          p === page ? (
            <span key={p} className={cx(cell, "bg-surface-2 text-ink")}>
              {p}
            </span>
          ) : (
            <a key={p} href={hrefFor(p)} className={cx(cell, "text-ink-muted hover:text-ink")}>
              {p}
            </a>
          ),
        )}
        {page < pages ? (
          <a href={hrefFor(page + 1)} className={cx(cell, "text-ink-muted hover:text-ink")}>
            ›
          </a>
        ) : (
          <span className={cx(cell, "text-line-strong")}>›</span>
        )}
      </nav>
    </div>
  );
}
