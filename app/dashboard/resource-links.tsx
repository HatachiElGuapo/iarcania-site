import { Labeled, Select, Button } from "@/components/ui";

const CANAL_ICON: Record<string, string> = { iarcania: "🟣", voidstoic: "🔵" };

// Compartido por tarea/hábito/bloque de Plan/cita — "llamar" un guion o un
// recurso (guía/SOP de Recursos) desde la actividad que se está por hacer,
// ej. abrir el guion o la guía de grabación antes de grabar. Server-safe:
// solo el <form action={...}> hace falta, sin estado cliente.
export function ResourceLinksForm({
  action,
  hiddenFields,
  scriptId,
  recursoId,
  scripts,
  recursos,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  scriptId: string | null;
  recursoId: string | null;
  scripts: { id: string; title: string; canal: string }[];
  recursos: { id: string; titulo: string; tipo: string }[];
}) {
  const linkedScript = scripts.find((s) => s.id === scriptId);
  const linkedRecurso = recursos.find((r) => r.id === recursoId);

  return (
    <div className="flex flex-col gap-3 rounded-ui border border-line bg-canvas px-3.5 py-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Guion y guía vinculados
      </span>

      {(linkedScript || linkedRecurso) && (
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          {linkedScript && (
            <a
              href={`/dashboard/guiones?canal=${linkedScript.canal}&open=${linkedScript.id}#script-${linkedScript.id}`}
              className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-ink hover:underline"
            >
              {CANAL_ICON[linkedScript.canal] ?? "🎬"} {linkedScript.title} →
            </a>
          )}
          {linkedRecurso && (
            <a
              href={`/dashboard/recursos?edit=${linkedRecurso.id}`}
              className="rounded-full border border-line px-3 py-1 text-ink-muted hover:text-ink hover:underline"
            >
              📋 {linkedRecurso.titulo} →
            </a>
          )}
        </div>
      )}

      <form action={action} className="flex flex-wrap items-end gap-2">
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Labeled label="Guion" className="min-w-[170px] flex-1">
          <Select name="scriptId" defaultValue={scriptId ?? ""}>
            <option value="">— Ninguno —</option>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {CANAL_ICON[s.canal] ?? ""} {s.title}
              </option>
            ))}
          </Select>
        </Labeled>
        <Labeled label="Guía / recurso" className="min-w-[170px] flex-1">
          <Select name="recursoId" defaultValue={recursoId ?? ""}>
            <option value="">— Ninguno —</option>
            {recursos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titulo}
              </option>
            ))}
          </Select>
        </Labeled>
        <Button type="submit" size="sm">
          Vincular
        </Button>
      </form>
    </div>
  );
}
