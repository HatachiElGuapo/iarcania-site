"use client";

import type { AgendaEvent } from "@/lib/agenda/day-events";
import { fmtTime } from "@/lib/agenda/time";
import { primaryActionFor } from "@/lib/plan/primary-action";
import { PlanBlockMenu } from "./plan/block-menu";
import { SubHabitsDropdown } from "./plan/block-check";
import { TaskHabitMenu } from "./day-row-menu";
import { SafeActionButton } from "./safe-action-button";
import { useToast } from "@/components/ui/toast";
import { pickBlockPraise, streakMilestoneCrossed, pickStreakMilestoneMessage, pickProtectorGainedMessage } from "@/lib/plan/praise";

// Una fila de "Tu día". El contenido (hora, ícono, título, badge) va DENTRO
// de un <button type="submit"> que ocupa toda la fila — clickear en
// cualquier parte marca/desmarca, no solo un cuadradito. El control de
// "saltado" de Plan y el link de editar quedan aparte, afuera del botón
// grande, para no perder ese click más chico.
export function DayEventRow({ ev, date }: { ev: AgendaEvent; date: string }) {
  const primary = primaryActionFor(ev, date);
  const toast = useToast();

  function handlePlanResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as {
      done: boolean;
      isMinimum: boolean;
      allMinimumsDone: boolean;
      streakBefore: number;
      streakAfter: number;
      protectorsBefore: number;
      protectorsAfter: number;
    };
    if (!r.done) return;
    const milestone = streakMilestoneCrossed(r.streakBefore, r.streakAfter);
    if (milestone) {
      toast.show({ message: pickStreakMilestoneMessage(milestone), tone: "success" });
    } else if (r.protectorsAfter > r.protectorsBefore) {
      toast.show({ message: pickProtectorGainedMessage(), tone: "success" });
    } else {
      toast.show({ message: pickBlockPraise(r), tone: "success" });
    }
  }

  function handleHabitResult(result: unknown) {
    if (!result || typeof result !== "object") return;
    const r = result as { done: boolean; toastMessage: string | null };
    if (r.toastMessage) toast.show({ message: r.toastMessage, tone: "success" });
  }

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
    <div className="flex flex-col gap-1 px-3.5 py-1">
      <div className="flex items-center gap-2">
        {primary ? (
          <SafeActionButton
            action={primary.action}
            fields={primary.fields}
            onResult={ev.kind === "plan" ? handlePlanResult : handleHabitResult}
            className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-ui py-2.5 text-left transition-colors duration-120 hover:bg-surface-2"
          >
            {content}
          </SafeActionButton>
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
      {ev.habitChecks && ev.habitChecks.length > 0 && (
        <div className="ml-9">
          <SubHabitsDropdown date={date} subHabits={ev.habitChecks} />
        </div>
      )}
    </div>
  );
}
