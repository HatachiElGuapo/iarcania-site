"use client";

import { usePathname } from "next/navigation";
import { Fab } from "@/components/ui/fab";

// Móvil · tab bar fijo (<768px, ver <BottomNav> en el layout del dashboard).
// Cuatro destinos + el Fab central, calcado de TabBar.dc.html del diseño:
// mismos íconos/paths, estado activo = accent-warm + peso 600. El resto de
// las 11 secciones vive detrás de "Más" hasta que tengan su propia pantalla
// móvil (ver docs de diseño "App Movil" · nota "doce pantallas").
const ON = "#E8A33D"; // = token accent-warm, mismo valor que TabBar.dc.html
const OFF = "#5A5870"; // = token ink-dim

type Key = "hoy" | "dinero" | "cuerpo" | "mas";

function activeKey(pathname: string): Key {
  if (pathname === "/dashboard") return "hoy";
  if (pathname.startsWith("/dashboard/dinero")) return "dinero";
  if (pathname.startsWith("/dashboard/cuerpo")) return "cuerpo";
  return "mas"; // el resto de las once secciones entra por "Más" (ver docs de diseño)
}

function NavItem({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-h-11 flex-col items-center justify-center gap-[5px]"
    >
      {children}
      <span className="text-[10px]" style={{ color: active ? ON : OFF, fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </a>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const active = activeKey(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end gap-0.5 border-t border-line bg-surface-sunken px-1.5 pb-[max(9px,env(safe-area-inset-bottom))] pt-[9px] md:hidden"
      aria-label="Navegación principal"
    >
      <NavItem href="/dashboard" label="Hoy" active={active === "hoy"}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active === "hoy" ? ON : OFF} strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
        </svg>
      </NavItem>
      <NavItem href="/dashboard/dinero" label="Dinero" active={active === "dinero"}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active === "dinero" ? ON : OFF} strokeWidth="1.8">
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </NavItem>
      <div className="flex justify-center">
        <Fab href="/dashboard?compose=1" className="mb-0.5" />
      </div>
      <NavItem href="/dashboard/cuerpo" label="Cuerpo" active={active === "cuerpo"}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active === "cuerpo" ? ON : OFF} strokeWidth="1.8">
          <path d="M6 4v6a6 6 0 0 0 12 0V4M6 20h12" />
        </svg>
      </NavItem>
      <NavItem href="/dashboard/mas" label="Más" active={active === "mas"}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active === "mas" ? ON : OFF} strokeWidth="1.8">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </NavItem>
    </nav>
  );
}
