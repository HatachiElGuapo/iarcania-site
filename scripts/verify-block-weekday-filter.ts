// Verificación de un solo uso: confirma que applyHabitToggle (app/
// dashboard/plan/actions.ts) escribe el plan_check SOLO en el plan_block
// cuyo weekday corresponde a la fecha marcada — no en TODOS los bloques
// enlazados a la activity. Reproduce exactamente el bug reportado en
// producción: un hábito enlazado a un bloque por cada día de la semana
// (ej. "Secundarios pendientes", weekday 0..6) terminaba con un
// plan_check en los 7 al marcarlo una sola vez, porque la cascada hacia
// arriba no filtraba blockLinks por weekday.
//
// Crea su propio plan/persona/7 bloques/hábito de prueba en una fecha
// falsa (no toca datos reales) y lo borra todo al final, pase o falle.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/verify-block-weekday-filter.ts <email>
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { plans, planPeople, planBlocks, planBlockActivities, planChecks } from "@/lib/db/schema/plan";
import { activities } from "@/lib/db/schema/habitos";
import { applyHabitToggle } from "@/app/dashboard/plan/actions";
import { weekdayMon0 } from "@/lib/date/bogota";

// 2099-01-01 es jueves (weekdayMon0 = 3, 0=lunes).
const FAKE_DATE = "2099-01-01";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: verify-block-weekday-filter.ts <email>");

  const targetWeekday = weekdayMon0(FAKE_DATE);
  console.log(`${FAKE_DATE} → weekdayMon0 = ${targetWeekday} (esperado 3, jueves)`);
  if (targetWeekday !== 3) throw new Error("FALLÓ: la fecha de prueba no es un jueves — ajustá FAKE_DATE");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [plan] = await db
    .insert(plans)
    .values({ ownerId: owner.id, name: "TEST verify-block-weekday-filter", startDate: "2000-01-01", endDate: FAKE_DATE })
    .returning({ id: plans.id });
  const [person] = await db
    .insert(planPeople)
    .values({ planId: plan.id, name: "Test", color: "#000000" })
    .returning({ id: planPeople.id });

  // 7 bloques, uno por weekday, mismo texto/kind — como "Secundarios
  // pendientes" en producción. created_at por defecto (ahora), bien
  // anterior a FAKE_DATE, así que ese filtro no interfiere.
  const blockRows = await db
    .insert(planBlocks)
    .values(
      Array.from({ length: 7 }, (_, weekday) => ({
        planId: plan.id,
        personId: person.id,
        weekday,
        startTime: "17:30",
        endTime: "18:00",
        text: "TEST Secundarios pendientes",
        kind: "secundarios",
      })),
    )
    .returning({ id: planBlocks.id, weekday: planBlocks.weekday });
  const blockIds = blockRows.map((b) => b.id);

  const [activity] = await db
    .insert(activities)
    .values({ userId: owner.id, name: "TEST hábito multi-bloque", frequency: "diaria" })
    .returning({ id: activities.id });
  await db.insert(planBlockActivities).values(blockIds.map((blockId) => ({ blockId, activityId: activity.id })));

  try {
    await applyHabitToggle(owner.id, activity.id, FAKE_DATE, true);

    const checks = await db
      .select({ blockId: planChecks.blockId })
      .from(planChecks)
      .where(inArray(planChecks.blockId, blockIds));
    console.log(`plan_checks creados para ${FAKE_DATE}: ${checks.length} (esperado 1)`);
    if (checks.length !== 1) throw new Error(`FALLÓ: se crearon ${checks.length} plan_checks en vez de 1`);

    const expectedBlockId = blockRows.find((b) => b.weekday === targetWeekday)!.id;
    console.log(`plan_check en el bloque weekday=${targetWeekday}: ${checks[0].blockId === expectedBlockId}`);
    if (checks[0].blockId !== expectedBlockId) throw new Error("FALLÓ: el plan_check quedó en el bloque equivocado");

    console.log("\n✅ OK: marcar el hábito solo crea el plan_check del bloque cuyo weekday corresponde a la fecha.");
  } finally {
    await db.delete(planChecks).where(inArray(planChecks.blockId, blockIds));
    await db.delete(planBlockActivities).where(eq(planBlockActivities.activityId, activity.id));
    await db.delete(activities).where(eq(activities.id, activity.id));
    await db.delete(planBlocks).where(inArray(planBlocks.id, blockIds));
    await db.delete(planPeople).where(eq(planPeople.id, person.id));
    await db.delete(plans).where(eq(plans.id, plan.id));
    console.log("\nLimpieza: borrado el plan/persona/7 bloques/hábito de prueba.");
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
