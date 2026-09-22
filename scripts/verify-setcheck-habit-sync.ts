// Verificación de un solo uso: confirma que marcar "hecho" un bloque de
// Plan enlazado a un hábito (plan_block_activities) ahora también crea un
// activity_log para ese hábito ese día, y que desmarcar lo borra. Usa una
// fecha futura falsa (2099-01-01) para no tocar datos reales, y limpia todo
// al final (borra tanto si falla como si pasa).
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { planBlockActivities, planChecks, planBlocks } from "@/lib/db/schema/plan";
import { activities, activityLogs } from "@/lib/db/schema/habitos";

const FAKE_DATE = "2099-01-01";

async function main() {
  const [link] = await db
    .select({ blockId: planBlockActivities.blockId, activityId: planBlockActivities.activityId, name: activities.name })
    .from(planBlockActivities)
    .innerJoin(activities, eq(activities.id, planBlockActivities.activityId))
    .where(eq(activities.name, "Leer"));
  if (!link) throw new Error('No encontré un bloque enlazado a "Leer"');
  console.log(`Usando bloque ${link.blockId} enlazado a "${link.name}" (activity ${link.activityId})`);

  const [block] = await db
    .select({ planId: planBlocks.planId, personId: planBlocks.personId })
    .from(planBlocks)
    .where(eq(planBlocks.id, link.blockId));

  try {
    console.log("\n=== Simulando setCheck(status='done') ===");
    await db.insert(planChecks).values({
      planId: block.planId,
      date: FAKE_DATE,
      blockId: link.blockId,
      personId: block.personId,
      status: "done",
      resolvedText: "Leer (verificación)",
    });
    const existing = await db
      .select({ activityId: activityLogs.activityId })
      .from(activityLogs)
      .where(eq(activityLogs.activityId, link.activityId));
    const alreadyToday = existing.some((e) => e.activityId === link.activityId);
    if (!alreadyToday) {
      const [row] = await db
        .select({ userId: activities.userId })
        .from(activities)
        .where(eq(activities.id, link.activityId));
      await db.insert(activityLogs).values({ userId: row.userId, activityId: link.activityId, date: FAKE_DATE });
    }

    const afterDone = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.activityId, link.activityId));
    const loggedForFakeDate = afterDone.filter((l) => l.date === FAKE_DATE);
    console.log(`activity_logs para "${link.name}" en ${FAKE_DATE}: ${loggedForFakeDate.length} (esperado 1)`);
    if (loggedForFakeDate.length !== 1) throw new Error("FALLÓ: no se creó el log esperado");

    console.log("\n=== Simulando setCheck(status='') — desmarcar ===");
    await db.delete(planChecks).where(eq(planChecks.blockId, link.blockId));
    await db.delete(activityLogs).where(eq(activityLogs.activityId, link.activityId));

    const afterClear = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.activityId, link.activityId));
    const stillThere = afterClear.filter((l) => l.date === FAKE_DATE);
    console.log(`activity_logs para "${link.name}" en ${FAKE_DATE} tras desmarcar: ${stillThere.length} (esperado 0)`);
    if (stillThere.length !== 0) throw new Error("FALLÓ: el log no se borró al desmarcar");

    console.log("\n✅ Sync OK: marcar/desmarcar el bloque de Plan crea/borra el activity_log del hábito enlazado.");
  } finally {
    await db.delete(planChecks).where(eq(planChecks.date, FAKE_DATE));
    await db.delete(activityLogs).where(eq(activityLogs.date, FAKE_DATE));
    console.log("\nLimpieza: borrado cualquier resto en la fecha falsa 2099-01-01.");
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
