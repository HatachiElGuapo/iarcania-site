import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { MobileTabs } from "@/components/app/mobile-tabs";

const MOBILE_TABS = [
  { href: "/dashboard/cuerpo", label: "Entreno" },
  { href: "/dashboard/cuerpo/nutricion", label: "Nutrición" },
];

// Nutrición es pestaña de Cuerpo (5g), no sección propia.
export default function CuerpoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 pb-28 md:p-8 md:pb-8">
      <div className="hidden md:block">
        <PageHeader icon="🏋️" title="Cuerpo" tabs={<SubNav />} />
      </div>
      <div className="mb-5 md:hidden">
        <SectionHeader title="Cuerpo" />
        <MobileTabs tabs={MOBILE_TABS} />
      </div>
      {children}
    </div>
  );
}
