import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 01 — PageHeader (reemplazó al viejo components/app/page-header.tsx,
// ya borrado). Emoji de sección (el mismo que en el sidebar) + título serif
// 21px + subtítulo de CONTEOS REALES, nunca decorativo + máximo una acción
// primaria y dos secundarias. `tabs` es el slot para <SubNav>, que se monta
// bajo el título sobre el borde.
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  tabs,
  className,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("mb-5", className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-[21px] font-bold text-ink">
            {icon != null && <span className="text-[19px] leading-none">{icon}</span>}
            {title}
          </h1>
          {subtitle != null && <p className="mt-1 text-meta text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-3.5 border-b border-line">{tabs}</div>}
    </header>
  );
}
