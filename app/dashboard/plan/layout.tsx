import { PageHeader } from "@/components/ui";
import { SectionHeader } from "@/components/ui/section-header";
import { MobileTabs } from "@/components/app/mobile-tabs";

// "Plantilla semanal" — ya no es un item propio del menú lateral (se
// accede con el botón "Editar semana" de Rutinas, ver app/dashboard/
// page.tsx). Sus pestañas (Semana/Fases y colas/Eventos/Historial) ya no
// se derivan de NAV_GROUPS (esa entrada se borró de components/app/
// nav-groups.ts) — quedan fijas acá, reusando <MobileTabs> en vez de
// <SubNav> tanto en escritorio como en móvil.
const TABS = [
  { href: "/dashboard/plan/semana", label: "Semana" },
  { href: "/dashboard/plan/fases", label: "Fases y colas" },
  { href: "/dashboard/plan/eventos", label: "Eventos" },
  { href: "/dashboard/plan/historial", label: "Historial" },
];

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 pb-28 md:p-8 md:pb-8">
      <div className="hidden md:block">
        <PageHeader icon="🗺️" title="Plantilla semanal" tabs={<MobileTabs tabs={TABS} className="w-max" />} />
      </div>
      <div className="mb-5 md:hidden">
        <SectionHeader title="Plantilla semanal" />
        <div className="-mx-4 overflow-x-auto px-4">
          <MobileTabs tabs={TABS} className="mt-3 w-max" />
        </div>
      </div>
      {children}
    </div>
  );
}
