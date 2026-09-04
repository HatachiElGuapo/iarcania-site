"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/components/app/nav-links";
import { cx } from "./cx";

// 5c — Sub-navegación de sección: pestañas que son RUTAS reales (<a> a rutas
// hijas), no estado cliente. El segmento de la ruta decide la pestaña
// activa, así el back del navegador y los enlaces compartidos funcionan.
// Deriva las pestañas de NAV_GROUPS (fuente única) según la ruta actual;
// devuelve null si la sección no tiene hijos. Se monta en el slot `tabs` del
// PageHeader, debajo del título y sobre el borde inferior.
export function SubNav({ counts }: { counts?: Record<string, ReactNode> }) {
  const pathname = usePathname();

  const item = NAV_GROUPS.flatMap((g) => g.items).find(
    (it) =>
      it.children?.length &&
      (pathname === it.href || pathname.startsWith(it.href + "/")),
  );
  if (!item?.children?.length) return null;

  const tabs = [
    ...(item.tabLabel ? [{ href: item.href, label: item.tabLabel }] : []),
    ...item.children,
  ];

  return (
    <nav className="-mb-px flex flex-wrap items-end gap-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "focus-ring inline-flex items-center gap-1.5 rounded-t-ui border-b-2 px-3 py-2 text-body transition-colors duration-120",
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {counts?.[t.href] != null && (
              <span className="text-[10px] text-ink-dim">{counts[t.href]}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
