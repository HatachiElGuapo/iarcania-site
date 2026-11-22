import { auth } from "@/lib/auth";
import { loadPlanContextForUser } from "@/lib/plan/load";
import { Card, EmptyState } from "@/components/ui";

// Lectura de plan_events (cumpleaños, Nochebuena, etc. — ver scripts/
// seed-plan.ts) — antes solo se veían día por día en "Eventos del día" de
// /dashboard/plan (quitada). No había ninguna pantalla con la lista
// completa; esta es nueva, de solo lectura (nunca hubo edición desde la
// UI para plan_events, así que no hay nada que migrar ahí).
export default async function PlanEventosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ctx = await loadPlanContextForUser(userId);
  if (!ctx) {
    return <EmptyState icon="🎉">Todavía no hay ningún plan importado.</EmptyState>;
  }

  const nameById = new Map(ctx.people.map((p) => [p.id, p.name]));
  const sorted = [...ctx.events].sort((a, b) => {
    const ak = a.date ?? `--${String(a.monthDay ?? 0).padStart(2, "0")}`;
    const bk = b.date ?? `--${String(b.monthDay ?? 0).padStart(2, "0")}`;
    return ak.localeCompare(bk);
  });

  return (
    <Card title="Eventos del plan" count={sorted.length}>
      {sorted.length === 0 ? (
        <EmptyState icon="🎉">Sin eventos cargados — se importan con scripts/seed-plan.ts.</EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {sorted.map((e) => (
            <div key={e.id} className="flex items-center gap-2.5 py-2 text-meta">
              <span className="w-24 shrink-0 tabular-nums text-ink-dim">
                {e.date ?? `día ${e.monthDay} de cada mes`}
              </span>
              {e.startTime && <span className="shrink-0 tabular-nums text-ink-dim">{e.startTime}</span>}
              <span className="min-w-0 flex-1 text-ink">{e.text}</span>
              {e.personId && nameById.get(e.personId) && <span className="shrink-0 text-ink-dim">{nameById.get(e.personId)}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
