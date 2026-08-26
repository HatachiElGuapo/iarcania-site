import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Rutinas" },
  { href: "/dashboard/trabajo", label: "Trabajo" },
  { href: "/dashboard/brujula", label: "Brújula" },
  { href: "/dashboard/actividades", label: "Actividades" },
  { href: "/dashboard/agenda", label: "Agenda" },
  { href: "/dashboard/ideas", label: "Ideas" },
  { href: "/dashboard/citas", label: "Citas" },
  { href: "/dashboard/eventos", label: "Eventos" },
  { href: "/dashboard/personas", label: "Personas" },
  { href: "/dashboard/habitos", label: "Hábitos" },
  { href: "/dashboard/cuerpo", label: "Cuerpo" },
  { href: "/dashboard/hogar", label: "Hogar" },
  { href: "/dashboard/reloj", label: "Reloj" },
  { href: "/dashboard/dinero", label: "Dinero" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/libros", label: "Libros" },
  { href: "/dashboard/guiones", label: "Guiones" },
  { href: "/dashboard/slides", label: "Slides" },
  { href: "/dashboard/recursos", label: "Recursos" },
  { href: "/dashboard/workspace", label: "Workspace" },
  { href: "/dashboard/crm", label: "CRM" },
  { href: "/dashboard/escuela", label: "Escuela" },
  { href: "/dashboard/planner", label: "Planner" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-bg-deep">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <nav className="space-y-1 text-sm text-text-muted">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-sm px-2 py-1.5 hover:bg-bg-card hover:text-text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
