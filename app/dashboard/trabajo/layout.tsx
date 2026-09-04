import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";

// Pestañas derivadas de NAV_GROUPS (fuente única) vía <SubNav>.
export default function TrabajoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <PageHeader icon="💼" title="Trabajo" tabs={<SubNav />} />
      {children}
    </div>
  );
}
