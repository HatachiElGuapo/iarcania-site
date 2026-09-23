import { notFound } from "next/navigation";
import Link from "next/link";
import { Textarea, Button } from "@/components/ui";
import { SectionHeader } from "@/components/ui/section-header";
import { getActivityDetail, updateActivityContent } from "../actions";

const FREQ_LABEL: Record<string, string> = {
  diaria: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  unica: "Única vez",
  recurrente: "Recurrente",
};

// Página de contenido de un hábito — distinta de la nota del día
// (activity_logs.notes, "qué hiciste hoy"): esto es activities.notes, sin
// fecha, para ir escribiendo/afinando algo con el tiempo — ej. el guion de
// la rutina de la mañana, acostado antes de dormir en vez de redes
// sociales.
export default async function HabitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getActivityDetail(id);
  if (!habit) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8">
      <SectionHeader
        title={habit.name}
        eyebrow={[habit.category, FREQ_LABEL[habit.frequency] ?? habit.frequency].filter(Boolean).join(" · ")}
        action={
          <Link href="/dashboard/habitos" className="text-[12px] text-ink-dim">
            ← Hábitos
          </Link>
        }
      />

      <form action={updateActivityContent} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={habit.id} />
        <Textarea
          name="notes"
          defaultValue={habit.notes ?? ""}
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
