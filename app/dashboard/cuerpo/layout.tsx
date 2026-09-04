import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";

// Nutrición es pestaña de Cuerpo (5g), no sección propia.
export default function CuerpoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <PageHeader icon="🏋️" title="Cuerpo" tabs={<SubNav />} />
      {children}
    </div>
  );
}
