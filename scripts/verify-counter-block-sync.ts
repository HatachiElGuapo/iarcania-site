// Verificación de un solo uso: confirma que al llegar a la meta de un
// hábito contador (ver adjustCounter en app/dashboard/habitos/actions.ts)
// el bloque de Plan que lo enlaza queda plan_checks.status='done', y que
// al bajar de la meta se desmarca. Reproduce exactamente el bug: el valor
// se escribía DESPUÉS de que la cascada calculara el done del bloque,
// así que éste nunca llegaba a marcarse aunque el hábito sí quedara
// "hecho" — applyHabitToggle ahora recibe `valueOverride` y lo escribe
// DENTRO de la misma transacción, antes de ese cálculo.
//
// Llama a applyHabitToggle directamente (no a adjustCounter, que exige
// una sesión de NextAuth real vía auth() — no disponible en un script) con
// exactamente los mismos valores que adjustCounter calcularía en cada
// paso, así que ejercita el mismo camino de código que arregla el bug.
//
// Crea su propio plan/persona/bloque/hábito de prueba en una fecha falsa
// (no toca datos reales) y lo borra todo al final, pase o falle.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/verify-counter-block-sync.ts <email>
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { plans, planPeople, planBlocks, planBlockActivities, planChecks } from "@/lib/db/schema/plan";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { applyHabitToggle } from "@/app/dashboard/plan/actions";
import { isCounterDone } from "@/lib/habits/counter";

const FAKE_DATE = "2099-01-01";
const TARGET = 1000;

async function writeValueDirect(userId: string, activityId: string, value: number) {
  const [row] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(eq(activityLogs.activityId, activityId));
  if (row) {
    await db.update(activityLogs).set({ value }).where(eq(activityLogs.id, row.id));
  } else {
    await db.insert(activityLogs).values({ userId, activityId, date: FAKE_DATE, value });
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: verify-counter-block-sync.ts <email>");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [plan] = await db
    .insert(plans)
    .values({ ownerId: owner.id, name: "TEST verify-counter-block-sync", startDate: FAKE_DATE, endDate: FAKE_DATE })
    .returning({ id: plans.id });
  const [person] = await db
    .insert(planPeople)
    .values({ planId: plan.id, name: "Test", color: "#000000" })
    .returning({ id: planPeople.id });
  const [block] = await db
    .insert(planBlocks)
    .values({
      planId: plan.id,
      personId: person.id,
      weekday: 3,
      startTime: "08:00",
      endTime: "09:00",
      text: "TEST contador",
      kind: "rutina",
    })
    .returning({ id: planBlocks.id });
  const [activity] = await db
    .insert(activities)
    .values({
      userId: owner.id,
      name: "TEST 1000 saltos",
      frequency: "diaria",
      targetValue: TARGET,
      unit: "saltos",
      countSteps: [100, 200],
    })
    .returning({ id: activities.id });
  await db.insert(planBlockActivities).values({ blockId: block.id, activityId: activity.id });

  try {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const next = value + 200;
      const wasDone = isCounterDone(value, TARGET);
      const nowDone = isCounterDone(next, TARGET);
      if (nowDone === wasDone) {
        await writeValueDirect(owner.id, activity.id, next);
      } else {
        await applyHabitToggle(owner.id, activity.id, FAKE_DATE, nowDone, next);
      }
      value = next;
    }
    console.log(`Valor tras +200 x5: ${value} (esperado ${TARGET})`);
    if (value !== TARGET) throw new Error("FALLÓ: el valor acumulado no es el esperado");

    const [checkAfterUp] = await db
      .select({ status: planChecks.status })
      .from(planChecks)
      .where(eq(planChecks.blockId, block.id));
    console.log(`plan_checks.status tras llegar a la meta: ${checkAfterUp?.status ?? "(sin fila)"} (esperado "done")`);
    if (checkAfterUp?.status !== "done") throw new Error("FALLÓ: el bloque no quedó done al llegar a la meta");

    // -100: cruza la meta hacia abajo.
    const next = value - 100;
    const nowDone = isCounterDone(next, TARGET);
    await applyHabitToggle(owner.id, activity.id, FAKE_DATE, nowDone, next);
    value = next;

    const [checkAfterDown] = await db
      .select({ status: planChecks.status })
      .from(planChecks)
      .where(eq(planChecks.blockId, block.id));
    console.log(
      `plan_checks.status tras bajar de la meta: ${checkAfterDown?.status ?? "(sin fila, no done)"} (no debe ser "done")`,
    );
    if (checkAfterDown?.status === "done") throw new Error("FALLÓ: el bloque sigue done después de bajar de la meta");

    const [logAfterDown] = await db
      .select({ value: activityLogs.value })
      .from(activityLogs)
      .where(eq(activityLogs.activityId, activity.id));
    console.log(`activity_logs.value tras bajar: ${logAfterDown?.value} (esperado ${value})`);
    if (logAfterDown?.value !== value) throw new Error("FALLÓ: no se conservó el valor parcial al desmarcar");

    console.log("\n✅ OK: el bloque se marca done al llegar a la meta y se desmarca al bajar, con el valor real preservado.");
  } finally {
    await db.delete(planChecks).where(eq(planChecks.blockId, block.id));
    await db.delete(activityLogs).where(eq(activityLogs.activityId, activity.id));
    await db.delete(planBlockActivities).where(eq(planBlockActivities.blockId, block.id));
    await db.delete(activities).where(eq(activities.id, activity.id));
    await db.delete(planBlocks).where(eq(planBlocks.id, block.id));
    await db.delete(planPeople).where(eq(planPeople.id, person.id));
    await db.delete(plans).where(eq(plans.id, plan.id));
    console.log("\nLimpieza: borrado el plan/persona/bloque/hábito de prueba.");
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
