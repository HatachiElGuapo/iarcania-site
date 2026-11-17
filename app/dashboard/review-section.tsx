"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import type { OrphanActivity, OrphanPlanBlock } from "@/lib/plan/orphans";
import { addHabitToPlan, removePlanBlock } from "./plan/actions";
import { archiveActivity, unarchiveActivity } from "./habitos/actions";

const WEEKDAY_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// "Por revisar" — desajustes entre hábitos (activities) y el Plan
// (plan_blocks) que hoy son invisibles: un hábito activo sin bloque, o un
// bloque que sigue apuntando a un hábito ya inactivo. Ver lib/plan/orphans.ts.
export function ReviewSection({
  orphanActivities,
  orphanBlocks,
}: {
  orphanActivities: OrphanActivity[];
  orphanBlocks: OrphanPlanBlock[];
}) {
  if (orphanActivities.length === 0 && orphanBlocks.length === 0) return null;

  return (
    <Card title="Por revisar" count={orphanActivities.length + orphanBlocks.length} className="border-accent-warm/25 bg-accent-warm/[0.04]">
      <div className="flex flex-col gap-3">
        {orphanActivities.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-meta text-ink-dim">Hábitos activos sin bloque en el Plan.</p>
            {orphanActivities.map((a) => (
              <OrphanActivityRow key={a.id} activity={a} />
            ))}
          </div>
        )}
        {orphanBlocks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-meta text-ink-dim">Bloques del Plan cuyo hábito ya está inactivo.</p>
            {orphanBlocks.map((b) => (
              <OrphanBlockRow key={b.blockId} block={b} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function OrphanActivityRow({ activity }: { activity: OrphanActivity }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [weekday, setWeekday] = useState("0");
  const [startTime, setStartTime] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const addToPlan = () =>
    run(() => addHabitToPlan({ activityId: activity.id, weekday: Number(weekday), startTime }));

  const archive = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", activity.id);
      return archiveActivity(fd);
    });

  return (
    <div className="flex flex-col gap-2 rounded-ui border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{activity.name}</span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink"
        >
          + Agregar al Plan
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={archive}
          className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-danger disabled:opacity-50"
        >
          Archivar
        </button>
      </div>
      {showForm && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            className="focus-ring rounded-ui border border-line bg-canvas px-2 py-1 text-[11px] text-ink"
          >
            {WEEKDAY_LABEL.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="focus-ring rounded-ui border border-line bg-canvas px-2 py-1 text-[11px] text-ink"
          />
          <button
            type="button"
            disabled={pending || !startTime}
            onClick={addToPlan}
            className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

function OrphanBlockRow({ block }: { block: OrphanPlanBlock }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const reactivate = () =>
    run(() => {
      const fd = new FormData();
      fd.set("id", block.activityId);
      return unarchiveActivity(fd);
    });

  const remove = () => run(() => removePlanBlock({ blockId: block.blockId }));

  return (
    <div className="flex items-center gap-2.5 rounded-ui border border-line bg-surface px-3 py-2.5">
      <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
        {WEEKDAY_LABEL[block.weekday]} {block.startTime}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{block.blockText}</span>
      <button
        type="button"
        disabled={pending}
        onClick={reactivate}
        className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink disabled:opacity-50"
      >
        Reactivar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-danger disabled:opacity-50"
      >
        Quitar del Plan
      </button>
    </div>
  );
}
