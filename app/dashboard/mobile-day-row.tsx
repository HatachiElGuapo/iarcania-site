"use client";

import type { AgendaEvent } from "@/lib/agenda/day-events";
import { fmtTime, fmtDuration } from "@/lib/agenda/time";
import { primaryActionFor } from "@/lib/plan/primary-action";
import { BlockIcon } from "@/lib/icons/habit-icons";
import { ListCard } from "@/components/ui/list-card";
import { PlanBlockMenu } from "./plan/block-menu";
import { DeferButton } from "./plan/defer-button";
import { MobileSubHabits } from "./plan/mobile-sub-habits";
import { TaskHabitMenu } from "./day-row-menu";
import { SafeActionButton } from "./safe-action-button";

// Fila móvil de "Tu día" — extraída a su propio archivo "use client"
// porque ahora necesita estado (el toggle ▸/▾ de MobileSubHabits exige
// hooks, y page.tsx es un Server Component). Tamaño uniforme en reposo:
// mismo ícono/hora/título (una sola línea con elipsis, antes line-clamp-2
// + la lista de hábitos sueltos inflaban la tarjeta según cuántos tuviera
// cada bloque) — lo único que cambia de alto es el árbol desplegado,
// manejado aparte por MobileSubHabits.
export function MobileDayRow({ ev, date }: { ev: AgendaEvent; date: string }) {
  const primary = primaryActionFor(ev, date);
  const hasTree = (ev.habitChecks && ev.habitChecks.length > 0) || (ev.extras && ev.extras.length > 0);

  const row = (
    <ListCard accent={ev.accent}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${
          ev.done ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
        }`}
      >
        ✓
      </span>
      <div className="flex w-14 shrink-0 flex-col items-start leading-tight">
        <span className="text-[11px] tabular-nums text-ink-dim">
          {ev.autoTime ? "—" : `${fmtTime(ev.start)}–${fmtTime(ev.start + ev.duration)}`}
        </span>
        {!ev.autoTime && <span className="text-[9px] tabular-nums text-ink-dim/70">{fmtDuration(ev.duration)}</span>}
      </div>
      {ev.kind === "plan" ? (
        <BlockIcon kind={ev.planKind ?? null} className="h-4 w-4 shrink-0 text-ink-dim" />
      ) : (
        <span className="shrink-0 text-[16px]">{ev.icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] leading-tight ${ev.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {ev.title}
        </div>
        {ev.badge && (
          <span
            className="mt-1 inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: `${ev.accent}22`, color: ev.accent }}
          >
            {ev.badge}
          </span>
        )}
      </div>
    </ListCard>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {primary ? (
          <SafeActionButton action={primary.action} fields={primary.fields} className="contents min-w-0 flex-1">
            {row}
          </SafeActionButton>
        ) : (
          <div className="min-w-0 flex-1">{row}</div>
        )}
        {ev.kind === "plan" && (
          <>
            <PlanBlockMenu date={date} blockId={ev.refId} startTime={fmtTime(ev.start)} text={ev.title} />
            <DeferButton date={date} blockId={ev.refId} text={ev.title} startTime={fmtTime(ev.start)} />
          </>
        )}
        {ev.itemType === "task" && ev.itemId && (
          <TaskHabitMenu kind="task" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
        )}
        {(ev.itemType === "habit" || ev.itemType === "habito") && ev.itemId && (
          <TaskHabitMenu kind="habit" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
        )}
      </div>
      {ev.kind === "plan" && hasTree && (
        <div className="ml-2">
          <MobileSubHabits date={date} blockId={ev.refId} subHabits={ev.habitChecks ?? []} extras={ev.extras ?? []} />
        </div>
      )}
    </div>
  );
}
