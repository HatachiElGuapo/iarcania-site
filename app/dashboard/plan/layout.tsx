import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";

// Pestañas derivadas de NAV_GROUPS (fuente única) vía <SubNav> — mismo
// patrón que Hábitos/Trabajo/Cuerpo. Antes cada página de Plan tenía su
// propio PageHeader y no había forma de saltar entre Día/Semana/Fases/
// Historial salvo por el sidebar.
export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <PageHeader icon="🗺️" title="Plan diario" tabs={<SubNav />} />
      {children}
    </div>
  );
}
