import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { MobileTabs } from "@/components/app/mobile-tabs";

// Móvil (pantalla 03 del diseño): solo las tres pestañas que destaca el
// diseño — el resto de las ocho de escritorio (facturas, presupuesto,
// deudas, metas, escanear) sigue entrando por su propia ruta, solo que sin
// cabecera móvil todavía.
const MOBILE_TABS = [
  { href: "/dashboard/dinero/cobros", label: "Cobros" },
  { href: "/dashboard/dinero/gastos", label: "Gastos" },
  { href: "/dashboard/dinero/cuentas", label: "Cuentas" },
];

export default function DineroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 pb-28 md:p-8 md:pb-8">
      <div className="hidden md:block">
        <PageHeader icon="💰" title="Dinero" tabs={<SubNav />} />
      </div>
      <div className="mb-5 md:hidden">
        <SectionHeader title="Dinero" />
        <MobileTabs tabs={MOBILE_TABS} />
      </div>
      {children}
    </div>
  );
}
