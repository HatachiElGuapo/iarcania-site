"use client";

import { useEffect, useState } from "react";
import type { AgendaEvent } from "@/lib/agenda/day-events";
import { fmtTime, fmtDuration } from "@/lib/agenda/time";
import { primaryActionFor } from "@/lib/plan/primary-action";
import { BlockIcon } from "@/lib/icons/habit-icons";
import { ListCard } from "@/components/ui/list-card";
import { PlanBlockMenu } from "./plan/block-menu";
import { MobileSubHabits } from "./plan/mobile-sub-habits";
import { HabitTreeDnd } from "./plan/habit-tree-dnd";
import { ExtrasSection } from "./plan/extras-section";
import { useFlexibleBlockCollapse } from "./plan/flexible-collapse";
import { TaskHabitMenu } from "./day-row-menu";
import { SafeActionButton } from "./safe-action-button";
import { planCardWrapperClass, planCardCheckboxClass } from "@/lib/plan/block-style";
import type { HabitNode } from "@/lib/plan/sub-habits";
import { cascadeDoneInGroups, countTotals, SecondaryModalContent } from "./secondary-section";
import { filterSecondaryGroupsForBlock, type SecondaryBand, type SecondaryEntry } from "@/lib/plan/secondary-bands";

function countDeep(nodes: HabitNode[]): { done: number; total: number } {
  return nodes.reduce(
    (acc, n) => {
      const child = countDeep(n.children);
      return { done: acc.done + (n.done ? 1 : 0) + child.done, total: acc.total + 1 + child.total };
    },
    { done: 0, total: 0 },
  );
}

// Fila móvil de "Tu día" — extraída a su propio archivo "use client"
// porque ahora necesita estado (el toggle ▸/▾ de MobileSubHabits exige
// hooks, y page.tsx es un Server Component). Tamaño uniforme en reposo:
// mismo ícono/hora/título (una sola línea con elipsis, antes line-clamp-2
// + la lista de hábitos sueltos inflaban la tarjeta según cuántos tuviera
// cada bloque) — lo único que cambia de alto es el árbol desplegado,
// manejado aparte por MobileSubHabits.
export function MobileDayRow({
  ev,
  date,
  secondaryGroups,
}: {
  ev: AgendaEvent;
  date: string;
  secondaryGroups?: Record<SecondaryBand, SecondaryEntry[]>;
}) {
  const primary = primaryActionFor(ev, date);
  const hasTree = (ev.habitChecks && ev.habitChecks.length > 0) || (ev.extras && ev.extras.length > 0);
  const { open: flexibleOpen, toggle: toggleFlexible } = useFlexibleBlockCollapse(ev.refId, ev.done);
  const flexibleCount = ev.flexible ? countDeep(ev.habitChecks ?? []) : null;
  const isSecondaryBlock = ev.kind === "plan" && ev.planKind === "secundarios";

  const [secGroups, setSecGroups] = useState(secondaryGroups);
  useEffect(() => {
    if (secondaryGroups) setSecGroups(secondaryGroups);
  }, [secondaryGroups]);
  function onSecondaryToggled(activityId: string, done: boolean) {
    setSecGroups((g) => g && cascadeDoneInGroups(g, activityId, done));
  }
  // El bloque "secundarios" solo muestra/cuenta Mañana+Tarde que vencen
  // antes de que termine ESTE bloque — Noche (y lo que vence después)
  // sigue en la tarjeta "Secundarios"/Pendientes, no acá.
  const secGroupsForBlock =
    isSecondaryBlock && secGroups ? filterSecondaryGroupsForBlock(secGroups, fmtTime(ev.start + ev.duration)) : null;
  const secTotals = secGroupsForBlock ? countTotals(secGroupsForBlock) : null;

  const row = (
    <ListCard
      accent={ev.accent}
      className={`w-full min-w-0 box-border ${ev.kind === "plan" ? planCardWrapperClass(ev.done) : ""}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-ui border text-[12px] ${planCardCheckboxClass(ev.done)}`}
      >
        ✓
      </span>
      <div className="flex w-14 shrink-0 flex-col items-start leading-tight">
        <span className="text-[11px] tabular-nums text-ink-dim">
          {ev.flexible || ev.autoTime ? "—" : `${fmtTime(ev.start)}–${fmtTime(ev.start + ev.duration)}`}
        </span>
        {!ev.autoTime && !ev.flexible && (
          <span className="text-[9px] tabular-nums text-ink-dim/70">{fmtDuration(ev.duration)}</span>
        )}
      </div>
      {ev.kind === "plan" ? (
        <BlockIcon kind={ev.planKind ?? null} className="h-4 w-4 shrink-0 text-ink-dim" />
      ) : (
        <span className="shrink-0 text-[16px]">{ev.icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] leading-tight ${ev.done ? "text-ink-dim line-through" : "text-ink"}`}>
          {ev.title}
          {ev.flexible && (
            <span className="text-[11px] text-ink-dim">
              {" "}
              · cuando lo hagas
              {flexibleCount && flexibleCount.total > 0 && ` · ${flexibleCount.done}/${flexibleCount.total}`}
            </span>
          )}
          {isSecondaryBlock && secTotals && (
            <span className="text-[11px] text-ink-dim"> · {secTotals.done}/{secTotals.total} secundarios</span>
          )}
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

  // Ancho fijo para el botón final (⋯/⋮) — sin esto, una fila con botón y
  // una sin (citas/notas) le dejan distinto ancho disponible a su
  // ListCard, así que cada tarjeta terminaba midiendo distinto.
  // Reservando siempre el mismo espacio (justify-end, se ve vacío a la
  // izquierda cuando no hay botón) el ListCard de al lado queda con el
  // mismo ancho disponible en todas las filas.
  return (
    <div className="flex w-full min-w-0 flex-col gap-1 box-border">
      <div className="flex w-full min-w-0 items-center gap-2 box-border">
        {primary ? (
          <SafeActionButton action={primary.action} fields={primary.fields} className="contents min-w-0 flex-1">
            {row}
          </SafeActionButton>
        ) : (
          <div className="min-w-0 flex-1">{row}</div>
        )}
        <div className="flex w-11 shrink-0 items-center justify-end gap-2">
          {ev.kind === "plan" && (
            <PlanBlockMenu date={date} blockId={ev.refId} startTime={fmtTime(ev.start)} text={ev.title} />
          )}
          {ev.itemType === "task" && ev.itemId && (
            <TaskHabitMenu kind="task" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
          )}
          {(ev.itemType === "habit" || ev.itemType === "habito") && ev.itemId && (
            <TaskHabitMenu kind="habit" id={ev.itemId} date={date} startTime={ev.autoTime ? "" : fmtTime(ev.start)} title={ev.title} />
          )}
        </div>
      </div>
      {isSecondaryBlock && secGroupsForBlock && (
        <div className="ml-2">
          <SecondaryModalContent groups={secGroupsForBlock} date={date} onToggled={onSecondaryToggled} />
        </div>
      )}
      {!isSecondaryBlock && ev.kind === "plan" && hasTree && (
        <div className="ml-2">
          {ev.flexible ? (
            <>
              <button
                type="button"
                onClick={toggleFlexible}
                className="focus-ring flex min-h-9 items-center gap-1 text-[12px] text-ink-dim hover:text-ink"
              >
                {flexibleOpen ? "▾" : "▸"} Hábitos
                {flexibleCount && flexibleCount.total > 0 && ` (${flexibleCount.done}/${flexibleCount.total})`}
              </button>
              {flexibleOpen && (
                <>
                  {ev.habitChecks && ev.habitChecks.length > 0 && (
                    <div className="rounded-ui border border-line bg-surface-sunken p-1.5">
                      <HabitTreeDnd date={date} blockId={ev.refId} subHabits={ev.habitChecks} />
                    </div>
                  )}
                  <ExtrasSection date={date} blockId={ev.refId} extras={ev.extras ?? []} />
                </>
              )}
            </>
          ) : (
            <MobileSubHabits
              date={date}
              blockId={ev.refId}
              blockText={ev.title}
              subHabits={ev.habitChecks ?? []}
              extras={ev.extras ?? []}
            />
          )}
        </div>
      )}
    </div>
  );
}
