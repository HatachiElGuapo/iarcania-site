import { Labeled, Select, Button } from "@/components/ui";
import type { ScriptOption } from "@/lib/scripts-picker";

const CANAL_ICON: Record<string, string> = { iarcania: "🟣", voidstoic: "🔵" };
const CANAL_LABEL: Record<string, string> = { iarcania: "IArcanIA", voidstoic: "Void Stoic" };

// Compartido por tarea/hábito/bloque de Plan/cita — "llamar" un guion desde
// la actividad que se está por hacer y poder LEERLO ahí mismo, sin salir a
// Guiones (pedido explícito: antes solo quedaba un link de salida, no se
// veía el contenido). El botón "Editar en Guiones →" sigue existiendo para
// cuando sí hace falta tocar el guion completo. Server-safe.
export function ScriptLinkPanel({
  action,
  hiddenFields,
  scriptId,
  scripts,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  scriptId: string | null;
  scripts: ScriptOption[];
}) {
  const linkedScript = scripts.find((s) => s.id === scriptId) ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-ui border border-line bg-canvas px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Guion vinculado
        </span>
        {linkedScript && (
          <a
            href={`/dashboard/guiones?canal=${linkedScript.canal}&open=${linkedScript.id}#script-${linkedScript.id}`}
            className="text-[11.5px] font-medium text-accent hover:underline"
          >
            Editar en Guiones →
          </a>
        )}
      </div>

      {linkedScript ? (
        <div className="flex flex-col gap-2.5 rounded-ui border border-line bg-surface px-3.5 py-3 text-[13.5px] leading-relaxed">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[15px] font-bold text-ink">{linkedScript.title}</span>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
              {CANAL_ICON[linkedScript.canal] ?? "🎬"} {CANAL_LABEL[linkedScript.canal] ?? linkedScript.canal}
            </span>
          </div>
          {linkedScript.hook && <ScriptBlock label="Hook" text={linkedScript.hook} />}
          {linkedScript.body && <ScriptBlock label="Cuerpo" text={linkedScript.body} />}
          {linkedScript.cta && <ScriptBlock label="Cierre" text={linkedScript.cta} />}
          {!linkedScript.hook && !linkedScript.body && !linkedScript.cta && (
            <span className="text-ink-dim">Todavía no tiene contenido — ábrelo en Guiones para escribirlo.</span>
          )}
        </div>
      ) : (
        <span className="text-[12.5px] text-ink-dim">Ninguno vinculado todavía.</span>
      )}

      <form action={action} className="flex flex-wrap items-end gap-2">
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Labeled label={linkedScript ? "Cambiar guion" : "Vincular guion"} className="min-w-[200px] flex-1">
          <Select name="scriptId" defaultValue={scriptId ?? ""}>
            <option value="">— Ninguno —</option>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {CANAL_ICON[s.canal] ?? ""} {s.title}
              </option>
            ))}
          </Select>
        </Labeled>
        <Button type="submit" size="sm">
          Guardar
        </Button>
      </form>
    </div>
  );
}

function ScriptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">{label}</div>
      <div className="whitespace-pre-wrap text-ink">{text}</div>
    </div>
  );
}
