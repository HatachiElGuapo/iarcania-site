import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Textarea, Button } from "@/components/ui";
import { SectionHeader } from "@/components/ui/section-header";
import { listScriptOptions, listRecursoOptions } from "@/lib/recursos-picker";
import { ResourceLinksForm } from "../../resource-links";
import { getTaskDetail, updateTaskNotes, linkTaskResources } from "../actions";

// Página de contenido de una tarea — distinta de la nota rápida del panel
// "⋯" ("qué hiciste hoy"): esto es un lugar para escribir/afinar algo con
// calma, sin apuro de guardar en dos segundos — ej. ir armando el guion de
// una tarea de mañana, acostado, en vez de scrollear redes. Como las tareas
// no se repiten (a diferencia de hábitos y bloques de Plan), tasks.notes ya
// servía para esto — no hizo falta una columna nueva, solo esta página.
export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  const session = await auth();
  const userId = session!.user.id;
  const [scriptOptions, recursoOptions] = await Promise.all([
    listScriptOptions(userId),
    listRecursoOptions(),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8">
      <SectionHeader
        title={task.title}
        eyebrow={[task.category, task.priority, task.dueDate].filter(Boolean).join(" · ") || undefined}
        action={
          <Link href="/dashboard/actividades" className="text-[12px] text-ink-dim">
            ← Actividades
          </Link>
        }
      />

      <ResourceLinksForm
        action={linkTaskResources}
        hiddenFields={{ id: task.id }}
        scriptId={task.scriptId}
        recursoId={task.recursoId}
        scripts={scriptOptions}
        recursos={recursoOptions}
      />

      <form action={updateTaskNotes} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={task.id} />
        <Textarea
          name="notes"
          defaultValue={task.notes ?? ""}
          placeholder="Escribí acá con calma — un guion, ideas, lo que haga falta…"
          className="min-h-[50vh] w-full text-[16px] leading-relaxed"
        />
        <Button type="submit" className="self-start">
          Guardar
        </Button>
      </form>
    </div>
  );
}
