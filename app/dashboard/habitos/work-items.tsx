import { Select, Input, Textarea, Button } from "@/components/ui";
import type { ScriptOption } from "@/lib/scripts-picker";
import type { BookOption } from "@/lib/books-picker";
import { addActivityQueueItem, updateActivityQueueItem, deleteActivityQueueItem, moveActivityQueueItem } from "./actions";

const CANAL_ICON: Record<string, string> = { iarcania: "🟣", voidstoic: "🔵" };

export type WorkQueueItem = {
  id: string;
  text: string;
  notes: string | null;
  scriptId: string | null;
  bookId: string | null;
};

// Lista de una actividad "trabajo" (ej. cada negocio a contactar, cada
// video a grabar) — a diferencia de las colas de Plan, la posición
// "actual" (marcada abajo) avanza por cuántas veces se marcó CUMPLIDA la
// actividad, no por calendario: si no se cumple un día, sigue esperando en
// el mismo item.
export function WorkItemsPanel({
  activityId,
  items,
  currentItemId,
  scripts,
  books,
}: {
  activityId: string;
  items: WorkQueueItem[];
  currentItemId: string | null;
  scripts: ScriptOption[];
  books: BookOption[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-ui border border-line bg-canvas px-3.5 py-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Lista de items ({items.length})
      </span>

      {items.length === 0 ? (
        <p className="text-[12.5px] text-ink-dim">Sin items todavía — agregá el primero abajo.</p>
      ) : (
        <div className="flex flex-col divide-y divide-line rounded-ui border border-line">
          {items.map((item) => (
            <WorkItemRow
              key={item.id}
              item={item}
              isCurrent={item.id === currentItemId}
              scripts={scripts}
              books={books}
            />
          ))}
        </div>
      )}

      <form action={addActivityQueueItem} className="flex gap-1.5">
        <input type="hidden" name="activityId" value={activityId} />
        <Input name="text" placeholder="Nuevo item…" className="flex-1" required />
        <Button type="submit" variant="secondary" size="sm">
          + Agregar
        </Button>
      </form>
    </div>
  );
}

function WorkItemRow({
  item,
  isCurrent,
  scripts,
  books,
}: {
  item: WorkQueueItem;
  isCurrent: boolean;
  scripts: ScriptOption[];
  books: BookOption[];
}) {
  const linkedScript = item.scriptId ? scripts.find((s) => s.id === item.scriptId) : undefined;
  const linkedBook = item.bookId ? books.find((b) => b.id === item.bookId) : undefined;

  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 text-meta">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${isCurrent ? "text-accent" : "text-ink-dim"}`}>{isCurrent ? "→" : "○"}</span>
        <div className="min-w-0 flex-1">
          <span className={isCurrent ? "font-semibold text-ink" : "text-ink"}>{item.text}</span>
          {isCurrent && <span className="ml-1.5 text-[10.5px] text-accent">actual</span>}
          {item.notes && <div className="mt-0.5 text-[11px] text-ink-dim">{item.notes}</div>}
          {(linkedScript || linkedBook) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {linkedScript && (
                <a
                  href={`/dashboard/guiones?canal=${linkedScript.canal}&open=${linkedScript.id}#script-${linkedScript.id}`}
                  className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10.5px] text-ink hover:underline"
                >
                  {CANAL_ICON[linkedScript.canal] ?? "🎬"} {linkedScript.title}
                </a>
              )}
              {linkedBook && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-muted">
                  📖 {linkedBook.title}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <form action={moveActivityQueueItem}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" className="px-1 text-ink-dim hover:text-ink" aria-label="Mover arriba">
              ↑
            </button>
          </form>
          <form action={moveActivityQueueItem}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" className="px-1 text-ink-dim hover:text-ink" aria-label="Mover abajo">
              ↓
            </button>
          </form>
        </div>
      </div>

      <details className="ml-5">
        <summary className="cursor-pointer text-[10.5px] text-ink-dim hover:text-ink">✎ Editar</summary>
        <form action={updateActivityQueueItem} className="mt-1.5 flex flex-col gap-1.5">
          <input type="hidden" name="id" value={item.id} />
          <Input name="text" defaultValue={item.text} required />
          <Textarea name="notes" defaultValue={item.notes ?? ""} placeholder="Nota (opcional)" rows={2} />
          <div className="flex flex-wrap gap-1.5">
            <Select name="scriptId" defaultValue={item.scriptId ?? ""} className="min-w-[160px] flex-1">
              <option value="">— Sin guion —</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <Select name="bookId" defaultValue={item.bookId ?? ""} className="min-w-[160px] flex-1">
              <option value="">— Sin libro —</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Guardar
            </Button>
            <Button type="submit" formAction={deleteActivityQueueItem} variant="danger" size="sm">
              Borrar item
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
