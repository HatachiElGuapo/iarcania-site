import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Wordmark } from "@/components/brand/logo";
import { NavLinks } from "@/components/app/nav-links";
import { LogoutButton } from "@/components/app/logout-button";

// Shell del dashboard — migrado al sistema visual nuevo (4c). Sidebar 220px
// sobre surface-sunken, borde `line`, item activo con dorado (ver NavLinks).
// El fondo del área de contenido lo pinta el <body> (globals.css).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-line bg-surface-sunken print:hidden">
        <div className="border-b border-line p-6">
          <Wordmark size={18} />
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-ink-dim">
            Sistema Operativo
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-line px-5 py-4">
          <div className="mb-0.5 truncate text-xs font-medium text-ink-muted">
            {session.user?.name ?? "Usuario"}
          </div>
          <div className="mb-1.5 truncate text-xs text-ink-dim">{session.user?.email}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
