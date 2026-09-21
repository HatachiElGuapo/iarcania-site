// Corre el ARRANQUE del plan (plans.start_date/end_date + plan_phases)
// +N días. Festivos y eventos NO se tocan — son fechas reales del
// calendario (Nochebuena, festivos colombianos, cumpleaños), no relativas al
// plan. plan_blocks tampoco (son por weekday). Los overrides ya guardados
// para fechas que quedan ANTES del nuevo arranque quedan huérfanos (el
// resolver nunca vuelve a leerlos, porque el resolver no resuelve nada antes
// de plans.start_date) — se borran.
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/shift-plan-start.ts <email> <dias>          # solo muestra
//   node ... scripts/shift-plan-start.ts <email> <dias> --apply            # guarda
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { plans, planPhases, planOverrides } from "@/lib/db/schema/plan";
import { addDaysISO } from "@/lib/date/bogota";

const APPLY = process.argv.includes("--apply");

async function main() {
  const email = process.argv[2];
  const days = Number(process.argv[3]);
  if (!email || !Number.isInteger(days) || days === 0) throw new Error("Uso: shift-plan-start.ts <email> <dias> [--apply]");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);
  const [plan] = await db.select().from(plans).where(eq(plans.ownerId, owner.id));
  if (!plan) throw new Error("No hay plan para ese usuario");

  const phases = await db.select().from(planPhases).where(eq(planPhases.planId, plan.id));
  const newStart = addDaysISO(plan.startDate, days);
  const orphanedOverrides = await db.select().from(planOverrides).where(eq(planOverrides.planId, plan.id));
  const toOrphan = orphanedOverrides.filter((o) => o.date < newStart);

  console.log(`Plan "${plan.name}": ${plan.startDate} — ${plan.endDate} → ${newStart} — ${addDaysISO(plan.endDate, days)}`);
  console.log(`\n=== Fases (${phases.length}) ===`);
  for (const p of phases) console.log(`  ${p.name}: ${p.startDate}–${p.endDate} → ${addDaysISO(p.startDate, days)}–${addDaysISO(p.endDate, days)}`);
  console.log(`\n=== Festivos y eventos: sin cambios (son fechas reales del calendario) ===`);
  console.log(`\n=== Overrides que quedan antes del nuevo arranque (${toOrphan.length}) — se borran, ya nunca se van a leer ===`);
  for (const o of toOrphan) console.log(`  ${o.date} blockId=${o.blockId} (hora guardada: ${o.startTime ?? "—"})`);

  if (!APPLY) {
    console.log("\nDry-run — nada se guardó. Corré con --apply para persistir.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ startDate: newStart, endDate: addDaysISO(plan.endDate, days) })
      .where(eq(plans.id, plan.id));
    for (const p of phases) {
      await tx
        .update(planPhases)
        .set({ startDate: addDaysISO(p.startDate, days), endDate: addDaysISO(p.endDate, days) })
        .where(eq(planPhases.id, p.id));
    }
    if (toOrphan.length) {
      await tx.delete(planOverrides).where(lt(planOverrides.date, newStart));
    }
  });

  console.log("\nGuardado.");
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
