import { PageHeader } from "@/components/ui";
import { SubNav } from "@/components/ui/sub-nav";

export default function HabitosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8">
      <PageHeader icon="🔥" title="Hábitos" tabs={<SubNav />} />
      {children}
    </div>
  );
}
