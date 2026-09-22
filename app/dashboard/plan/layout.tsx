import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { MobileTabs } from "@/components/app/mobile-tabs";

// Pestañas derivadas de NAV_GROUPS (fuente única) vía <SubNav> — mismo
// patrón que Hábitos/Trabajo/Cuerpo. Antes cada página de Plan tenía su
// propio PageHeader y no había forma de saltar entre Día/Semana/Fases/
// Historial salvo por el sidebar.
//
// "Rutinas" (pantalla 07 del diseño móvil) es este mismo Plan diario, solo
// con otro título — el diseño lo llama así porque en móvil solo se ve la
// columna del propio usuario, sin la grilla familiar de escritorio (ver
// <MobilePlanDay> en page.tsx).
const MOBILE_TABS = [
  { href: "/dashboard/plan", label: "Día" },
  { href: "/dashboard/plan/semana", label: "Semana" },
  { href: "/dashboard/plan/fases", label: "Fases" },
  { href: "/dashboard/plan/historial", label: "Historial" },
];

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 pb-28 md:p-8 md:pb-8">
      <div className="hidden md:block">
        <PageHeader icon="🗺️" title="Plan diario" tabs={<SubNav />} />
      </div>
      <div className="mb-5 md:hidden">
        <SectionHeader title="Rutinas" />
        <div className="-mx-4 overflow-x-auto px-4">
          <MobileTabs tabs={MOBILE_TABS} className="mt-3 w-max" />
        </div>
      </div>
      {children}
    </div>
  );
}
