import { SubNav } from "@/components/ui/sub-nav";

// Enlaza cuerpo/nutricion (5g: Nutrición es pestaña de Cuerpo, no sección
// propia). Las páginas de Cuerpo ya traen su propio título y padding, así
// que aquí solo va la barra de pestañas. La sección se reestiliza entera en
// su fase de migración.
export default function CuerpoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-line px-8 pt-6">
        <SubNav />
      </div>
      {children}
    </div>
  );
}
