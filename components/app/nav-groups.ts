// Datos de navegación — separados de nav-links.tsx (que es "use client") para
// que un Server Component los pueda importar directo. Un Server Component
// que importa desde un módulo "use client" solo puede recibir componentes
// (referencias serializables), no un array plano — `NAV_GROUPS.map(...)`
// fallaba en tiempo de ejecución con "is not a function" hasta este split
// (ver <MasPage>, que lista estas mismas secciones en móvil).
//
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
      {
        href: "/dashboard/plan",
        label: "Plan diario",
        icon: "🗺️",
        tabLabel: "Día",
        children: [
          { href: "/dashboard/plan/semana", label: "Semana" },
          { href: "/dashboard/plan/fases", label: "Fases" },
          { href: "/dashboard/plan/historial", label: "Historial" },
        ],
      },
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
          { href: "/dashboard/dinero/presupuesto", label: "Presupuesto" },
          { href: "/dashboard/dinero/deudas", label: "Deudas" },
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
