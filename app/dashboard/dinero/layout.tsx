import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";

export default function DineroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <PageHeader icon="💰" title="Dinero" tabs={<SubNav />} />
      {children}
    </div>
  );
}
