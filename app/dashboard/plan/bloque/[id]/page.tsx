import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Textarea, Button } from "@/components/ui";
import { SectionHeader } from "@/components/ui/section-header";
import { kindInfo } from "@/lib/plan/kinds";
import { listScriptOptions } from "@/lib/scripts-picker";
import { ScriptLinkPanel } from "../../../script-link";
import { getBlockDetail, updateBlockContent, linkBlockScript } from "../../actions";

const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Página de contenido de un bloque de Plan — distinta de la nota del día
// (plan_checks.note, "qué hiciste hoy"): esto es plan_blocks.notes, sin
// fecha, para ir escribiendo/afinando algo con el tiempo. Pedido explícito:
// "acostado, ir afinando el guion de la mañana en vez de ver redes
// sociales" — un bloque recurrente (ej. "Video: oferta y precios") es
// exactamente el tipo de cosa que se beneficia de esto.
export default async function BlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const block = await getBlockDetail(id);
  if (!block) notFound();

  const kind = kindInfo(block.kind);
  const session = await auth();
  const userId = session!.user.id;
  const scriptOptions = await listScriptOptions(userId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8">
      <SectionHeader
        title={block.text}
        eyebrow={`${kind.icon} ${kind.label} · ${WEEKDAY_LABELS[block.weekday]} · ${block.startTime}${block.endTime ? `–${block.endTime}` : ""}`}
        action={
          <a href="/dashboard/plan" className="text-[12px] text-ink-dim">
            ← Rutinas
          </a>
        }
      />

      <ScriptLinkPanel
        action={linkBlockScript}
        hiddenFields={{ id: block.id }}
        scriptId={block.scriptId}
        scripts={scriptOptions}
      />

      <form action={updateBlockContent} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={block.id} />
        <Textarea
          name="notes"
          defaultValue={block.notes ?? ""}
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
