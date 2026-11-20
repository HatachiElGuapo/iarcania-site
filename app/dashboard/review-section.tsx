"use client";

import { useEffect, useState } from "react";
import type { OrphanActivity, OrphanPlanBlock } from "@/lib/plan/orphans";
import { addHabitToPlan, removePlanBlock } from "./plan/actions";
import { archiveActivity, unarchiveActivity } from "./habitos/actions";
import { SafeActionButton } from "./safe-action-button";

const WEEKDAY_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const OPEN_STORAGE_KEY = "dashboard.review.open";

// addHabitToPlan/removePlanBlock son Server Actions tipadas (reciben un
// objeto, no FormData) — adaptadores finos para poder usarlas con
// SafeActionButton (que siempre manda FormData), mismo patrón que
// defer-button.tsx.
async function addHabitToPlanFromForm(fd: FormData) {
  return addHabitToPlan({
    activityId: String(fd.get("activityId") || ""),
    weekday: Number(fd.get("weekday") || 0),
    startTime: String(fd.get("startTime") || ""),
  });
}

async function removePlanBlockFromForm(fd: FormData) {
  return removePlanBlock({ blockId: String(fd.get("blockId") || "") });
}

// "Por revisar" — desajustes entre hábitos (activities) y el Plan
// (plan_blocks) que hoy son invisibles: un hábito activo sin bloque, o un
// bloque que sigue apuntando a un hábito ya inactivo. Ver lib/plan/orphans.ts.
// Colapsada por defecto — no es algo urgente, no debe competir con "Tu día".
export function ReviewSection({
  orphanActivities,
  orphanBlocks,
}: {
  orphanActivities: OrphanActivity[];
  orphanBlocks: OrphanPlanBlock[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_STORAGE_KEY) === "1");
    } catch {
      // localStorage no disponible (SSR, modo privado, etc.) — queda cerrada.
    }
  }, []);

  const count = orphanActivities.length + orphanBlocks.length;
  if (count === 0) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Sin persistencia disponible — igual funciona para esta sesión.
    }
  }

  return (
    <section className="overflow-hidden rounded-ui-lg border border-accent-warm/25 bg-accent-warm/[0.04]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-2.5 border-b border-line bg-surface-2 px-3.5 py-3 text-left"
      >
        <span className="text-ink-dim">{open ? "▾" : "▸"}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Por revisar · {count}
        </span>
      </button>
      {open && (
        <div className="p-3.5">
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
        </div>
      )}
    </section>
  );
}

function OrphanActivityRow({ activity }: { activity: OrphanActivity }) {
  const [showForm, setShowForm] = useState(false);
  const [weekday, setWeekday] = useState("0");
  const [startTime, setStartTime] = useState("");

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
        <SafeActionButton
          action={archiveActivity}
          fields={{ id: activity.id }}
          className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-danger"
        >
          Archivar
        </SafeActionButton>
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
          <SafeActionButton
            action={addHabitToPlanFromForm}
            fields={{ activityId: activity.id, weekday, startTime }}
            disabled={!startTime}
            className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink disabled:opacity-50"
          >
            Agregar
          </SafeActionButton>
        </div>
      )}
    </div>
  );
}

function OrphanBlockRow({ block }: { block: OrphanPlanBlock }) {
  return (
    <div className="flex items-center gap-2.5 rounded-ui border border-line bg-surface px-3 py-2.5">
      <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
        {WEEKDAY_LABEL[block.weekday]} {block.startTime}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{block.blockText}</span>
      <SafeActionButton
        action={unarchiveActivity}
        fields={{ id: block.activityId }}
        className="focus-ring rounded-ui border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink"
      >
        Reactivar
      </SafeActionButton>
      <SafeActionButton
        action={removePlanBlockFromForm}
        fields={{ blockId: block.blockId }}
        className="focus-ring rounded-ui border border-line px-2.5 py-1 text-[11px] text-ink-dim hover:text-danger"
      >
        Quitar del Plan
      </SafeActionButton>
    </div>
  );
}
