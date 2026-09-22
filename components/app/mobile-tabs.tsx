"use client";

import { usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

// Móvil · tira de pestañas genérica para las cabeceras de sección (Dinero,
// Cuerpo, Clientes…) — versión reducida de <SubNav> para las pantallas que
// ya tienen su tratamiento móvil. `pathname === href` exacto (no prefijo):
// cada pestaña es una ruta real, así que basta con la coincidencia exacta.
export function MobileTabs({ tabs, className }: { tabs: { href: string; label: string }[]; className?: string }) {
  const pathname = usePathname();
  return (
    <Segmented
      className={className ?? "mt-3"}
      options={tabs.map((t) => ({ ...t, active: pathname === t.href }))}
    />
  );
}
