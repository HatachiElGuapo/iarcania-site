import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { Wordmark } from "@/components/brand/logo";
import { NavLinks } from "@/components/app/nav-links";
import { LogoutButton } from "@/components/app/logout-button";
import { BottomNav } from "@/components/app/bottom-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AutoRefresh } from "./auto-refresh";
import { StaleActionGuard } from "./stale-action-guard";
import { ReminderModal } from "./reminder-modal";

// Shell del dashboard — migrado al sistema visual nuevo (4c). Sidebar 220px
// sobre surface-sunken, borde `line`, item activo con dorado (ver NavLinks).
// El fondo del área de contenido lo pinta el <body> (globals.css).
//
// Móvil (<768px, ver docs de diseño "App Movil"): el sidebar se oculta
// (`hidden md:flex`, el layout de escritorio queda intacto desde `md` hacia
// arriba) y en su lugar aparece <BottomNav>, fijo abajo. Cada página decide
// su propio padding — este layout no fuerza nada por breakpoint.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <ToastProvider>
    <AutoRefresh />
    <StaleActionGuard />
    <ReminderModal />
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-surface-sunken print:hidden md:flex">
        <Link
          href="/dashboard"
          aria-label="Ir al inicio"
          className="focus-ring block border-b border-line p-6 transition-colors duration-120 hover:bg-surface"
        >
          <div className="flex items-center gap-2">
            <Image
              src="/brand/iarcania-icon-1024.png"
              alt=""
              width={28}
              height={28}
              className="shrink-0 rounded-md"
            />
            <Wordmark size={18} />
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-ink-dim">
            Sistema Operativo
          </div>
        </Link>
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
      <BottomNav />
    </div>
    </ToastProvider>
  );
}
