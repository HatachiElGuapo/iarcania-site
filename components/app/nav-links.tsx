"use client";

import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inicio",
    items: [{ href: "/dashboard", label: "Rutinas", icon: "🌅" }],
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
      { href: "/dashboard/habitos", label: "Hábitos", icon: "🔥" },
      { href: "/dashboard/cuerpo", label: "Cuerpo", icon: "🏋️" },
      { href: "/dashboard/hogar", label: "Hogar", icon: "🏠" },
      { href: "/dashboard/reloj", label: "Reloj", icon: "⏱️" },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { href: "/dashboard/trabajo", label: "Trabajo", icon: "💼" },
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
      { href: "/dashboard/dinero", label: "Dinero", icon: "💰" },
      { href: "/dashboard/clientes", label: "Clientes", icon: "🤝" },
      { href: "/dashboard/crm", label: "CRM", icon: "📊" },
      { href: "/dashboard/recursos", label: "Recursos", icon: "📦" },
      { href: "/dashboard/escuela", label: "Escuela", icon: "🎓" },
      { href: "/dashboard/workspace", label: "Workspace", icon: "🖥️" },
    ],
  },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="section-label mb-2 px-2">{group.label}</div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-purple-mid/10 font-semibold text-purple-light"
                      : "text-text-muted hover:bg-white/[0.03] hover:text-text-primary"
                  }`}
                >
                  <span className="w-4 text-center text-xs">{item.icon}</span>
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
