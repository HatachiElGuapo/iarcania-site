import { SubNav } from "@/components/ui/sub-nav";

// Pestañas derivadas de NAV_GROUPS (fuente única) vía <SubNav>. El resto de
// esta sección se reestiliza en su fase de migración.
export default function TrabajoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-text-primary">Trabajo</h1>
      <div className="mt-4 border-b border-line">
        <SubNav />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
