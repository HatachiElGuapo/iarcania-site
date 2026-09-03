import type { ReactNode } from "react";
import { cx } from "./cx";
import { catInfo } from "./category";

// 4b · 04 — ItemList. Alternativa a la tabla cuando la fila necesita dos
// líneas. Toda la fila es el enlace; el checkbox va como `leading` (un
// <form> aparte que provee el llamador).
export function ItemList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-1.5", className)}>{children}</div>;
}

export function ItemRow({
  href,
  category,
  leading,
  title,
  meta,
  trailing,
}: {
  href?: string;
  category?: string | null;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  const accent = category ? catInfo(category).color : "transparent";
  const cls =
    "flex items-center gap-2.5 rounded-ui border border-line bg-surface px-3 py-2.5 transition-colors duration-120";
  const style = { borderLeft: `3px solid ${accent}` };
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-[10.5px] text-ink-dim">{meta}</span>}
      </span>
      {trailing}
    </>
  );
  return href ? (
    <a href={href} className={cx(cls, "hover:border-line-strong")} style={style}>
      {body}
    </a>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
