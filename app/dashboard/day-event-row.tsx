import type { AgendaEvent } from "@/lib/agenda/day-events";
import { toggleTaskStatus } from "./actividades/actions";
import { toggleLogToday } from "./habitos/actions";
import { setCheck } from "./plan/actions";
import { completeAppointment } from "./citas/actions";
import { PlanBlockMenu } from "./plan/block-menu";
import { TaskHabitMenu } from "./day-row-menu";

export function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type RowAction = (formData: FormData) => void | Promise<void>;

// El toggle "principal" de cada fila — el que se dispara clickeando en
// cualquier parte de la fila, no solo un cuadradito chico. Plan además
// tiene "saltado" (✗) como control aparte, porque hecho/saltado no son
// opuestos de un solo booleano.
export function primaryActionFor(
  ev: AgendaEvent,
  date: string,
): { action: RowAction; fields: Record<string, string> } | null {
  if (ev.kind === "block" && ev.itemType === "task" && ev.itemId) {
    return { action: toggleTaskStatus, fields: { id: ev.itemId, nextStatus: ev.done ? "pendiente" : "completada" } };
  }
  if ((ev.kind === "habit" || (ev.kind === "block" && ev.itemType === "habito")) && ev.itemId) {
    return { action: toggleLogToday, fields: { activityId: ev.itemId, date } };
  }
  if (ev.kind === "block" && ev.itemType === "cita" && ev.itemId) {
    return { action: completeAppointment, fields: { id: ev.itemId } };
  }
  if (ev.kind === "plan") {
    return { action: setCheck, fields: { date, blockId: ev.refId, status: ev.done ? "" : "done" } };
  }
  return null;
}

// Una fila de "Tu día". El contenido (hora, ícono, título, badge) va DENTRO
// de un <button type="submit"> que ocupa toda la fila — clickear en
// cualquier parte marca/desmarca, no solo un cuadradito. El control de
// "saltado" de Plan y el link de editar quedan aparte, afuera del botón
// grande, para no perder ese click más chico.
export function DayEventRow({ ev, date }: { ev: AgendaEvent; date: string }) {
  const primary = primaryActionFor(ev, date);

  const content = (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
          ev.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="w-14 shrink-0 text-meta tabular-nums text-ink-dim">
        {ev.autoTime ? "—" : fmtTime(ev.start)}
      </span>
      <span className="shrink-0 text-[17px]">{ev.icon}</span>
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-body ${ev.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {ev.title}
        </span>
        {ev.habitChecks && ev.habitChecks.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1.5">
            {ev.habitChecks.map((h) => (
              <span key={h.name} className={`text-[10px] ${h.done ? "text-success" : "text-ink-dim"}`}>
                {h.done ? "✓" : "○"} {h.name}
              </span>
            ))}
          </span>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: `${ev.accent}22`, color: ev.accent }}
      >
        {ev.badge}
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-2 px-3.5 py-1">
      {primary ? (
        <form action={primary.action} className="min-w-0 flex-1">
          {Object.entries(primary.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button
            type="submit"
            className="focus-ring flex w-full items-center gap-3 rounded-ui py-2.5 text-left transition-colors duration-120 hover:bg-surface-2"
          >
            {content}
          </button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5">{content}</div>
      )}
      {ev.kind === "plan" && (
        <PlanBlockMenu date={date} blockId={ev.refId} startTime={fmtTime(ev.start)} text={ev.title} />
      )}
      {ev.itemType === "task" && ev.itemId && (
        <TaskHabitMenu kind="task" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
      )}
      {(ev.itemType === "habit" || ev.itemType === "habito") && ev.itemId && (
        <TaskHabitMenu kind="habit" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
      )}
      {ev.editHref && ev.kind !== "plan" && ev.itemType !== "task" && ev.itemType !== "habit" && ev.itemType !== "habito" && (
        <a href={ev.editHref} className="shrink-0 px-1 text-meta text-ink-dim hover:text-ink">
          ⋯
        </a>
      )}
    </div>
  );
}
