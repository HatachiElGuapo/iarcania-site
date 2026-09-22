"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "./nav-groups";

export { NAV_GROUPS };

// Sistema nuevo (4c/5a): grupos colapsables con flecha que rota, línea que
// se extiende del label, item activo con texto dorado (accent-warm) + borde
// izquierdo dorado de 3px + fondo surface-active (#161616). Nunca fondo
// violeta — el violeta es solo acción primaria.
export function NavLinks() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav className="py-2">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = !!collapsed[group.label];
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !c[group.label] }))}
              className="flex w-full select-none items-center gap-2 px-5 pb-1 pt-3 text-left text-[9px] uppercase tracking-[0.15em] text-ink-dim transition-colors duration-120 hover:text-ink-muted"
            >
              <span
                className={`inline-block flex-shrink-0 text-[8px] transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              >
                ▼
              </span>
              {group.label}
              <span className="h-px flex-1 bg-line" />
            </button>
            <div
              className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
              style={{ maxHeight: isCollapsed ? 0 : 400 }}
            >
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 border-l-[3px] px-5 py-[11px] text-[13px] transition-colors duration-120 ${
                      active
                        ? "border-accent-warm bg-surface-active text-accent-warm"
                        : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <span className="w-[18px] flex-shrink-0 text-center text-sm">{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
