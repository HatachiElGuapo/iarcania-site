"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

// `children` son sub-rutas reales (no items del sidebar): las deriva <SubNav>
// para las pestañas de sección. `tabLabel`, si está, hace que la propia ruta
// del item sea la primera pestaña (p. ej. "Hoy" en Trabajo). El sidebar
// sigue mostrando solo el primer nivel.
type SubItem = { href: string; label: string };
type NavItem = {
  href: string;
  label: string;
  icon: string;
  tabLabel?: string;
  children?: SubItem[];
};
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inicio",
    items: [
      { href: "/dashboard", label: "Rutinas", icon: "🌅" },
      { href: "/dashboard/marco", label: "Marco", icon: "📜" },
    ],
  },
  {
    label: "Vida personal",
    items: [
      { href: "/dashboard/actividades", label: "Actividades", icon: "✅" },
      { href: "/dashboard/agenda", label: "Agenda", icon: "📅" },
      { href: "/dashboard/ideas", label: "Ideas", icon: "💡" },
      { href: "/dashboard/citas", label: "Citas", icon: "🏥" },
      { href: "/dashboard/eventos", label: "Eventos", icon: "🎉" },
      { href: "/dashboard/personas", label: "Personas", icon: "👥" },
      {
        href: "/dashboard/habitos",
        label: "Hábitos",
        icon: "🔥",
        tabLabel: "Hábitos",
        children: [
          { href: "/dashboard/habitos/gestion", label: "Gestión" },
          { href: "/dashboard/habitos/rachas", label: "Rachas" },
        ],
      },
      {
        href: "/dashboard/cuerpo",
        label: "Cuerpo",
        icon: "🏋️",
        tabLabel: "Cuerpo",
        children: [{ href: "/dashboard/cuerpo/nutricion", label: "Nutrición" }],
      },
      { href: "/dashboard/hogar", label: "Hogar", icon: "🏠" },
      { href: "/dashboard/reloj", label: "Reloj", icon: "⏱️" },
    ],
  },
  {
    label: "Trabajo",
    items: [
      {
        href: "/dashboard/trabajo",
        label: "Trabajo",
        icon: "💼",
        tabLabel: "Hoy",
        children: [{ href: "/dashboard/trabajo/tareas", label: "Tareas" }],
      },
      { href: "/dashboard/brujula", label: "Brújula", icon: "🧭" },
    ],
  },
  {
    label: "Contenido",
    items: [
      { href: "/dashboard/libros", label: "Libros", icon: "📚" },
      { href: "/dashboard/guiones", label: "Guiones", icon: "🎬" },
      { href: "/dashboard/slides", label: "Slides", icon: "🖼️" },
      { href: "/dashboard/planner", label: "Planner", icon: "🗓️" },
    ],
  },
  {
    label: "Negocio",
    items: [
      {
        href: "/dashboard/dinero",
        label: "Dinero",
        icon: "💰",
        // /dashboard/dinero redirige a /cuentas — no es pestaña propia.
        children: [
          { href: "/dashboard/dinero/cuentas", label: "Cuentas" },
          { href: "/dashboard/dinero/facturas", label: "Facturas" },
          { href: "/dashboard/dinero/gastos", label: "Gastos" },
          { href: "/dashboard/dinero/cobros", label: "Cobros" },
          { href: "/dashboard/dinero/metas", label: "Metas" },
          { href: "/dashboard/dinero/escanear", label: "Escanear" },
        ],
      },
      { href: "/dashboard/clientes", label: "Clientes", icon: "🤝" },
      { href: "/dashboard/crm", label: "CRM", icon: "📊" },
      { href: "/dashboard/recursos", label: "Recursos", icon: "📦" },
      { href: "/dashboard/escuela", label: "Escuela", icon: "🎓" },
      { href: "/dashboard/workspace", label: "Workspace", icon: "🖥️" },
    ],
  },
];

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
