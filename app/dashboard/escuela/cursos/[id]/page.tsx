import { PageHeader, EmptyState } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-8">
      <PageHeader icon="🎓" title="Curso" subtitle={`ID ${id}`} />
      <EmptyState icon="🎓">
        Todavía no has migrado la vista de detalle del curso desde el sistema anterior. Por ahora
        edita cursos y clases desde la lista de Escuela.
      </EmptyState>
    </div>
  );
}
