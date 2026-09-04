import { PageHeader, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <div className="p-8">
      <PageHeader icon="🖼️" title="Slides" />
      <EmptyState icon="🖼️">
        Todavía no has migrado esta sección desde el sistema anterior. Cuando exista el editor de
        slides, aparecerá aquí.
      </EmptyState>
    </div>
  );
}
