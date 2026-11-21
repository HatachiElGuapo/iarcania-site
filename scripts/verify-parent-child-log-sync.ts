// Verificación de un solo uso: confirma que applyHabitToggle (app/
// dashboard/plan/actions.ts), al marcar/desmarcar un hijo, escribe/borra
// de verdad la fila de activity_logs del PADRE — no solo el booleano
// `parentJustCompleted` de antes, que servía para el toast pero nunca
// dejaba una fila propia, así que cualquier lectura directa de
// activity_logs (rachas, /dashboard/habitos) veía al padre como "no
// hecho" aunque sus hijos estuvieran todos marcados. Reproduce el reporte
// real: "Dientes" con hijos "Dientes mañana/tarde/noche" — se marcan los
// hijos, el padre no recibía su propio log.
//
// Fixture: un padre con 2 hijos (uno is_optional=true, para confirmar que
// eso no exime a un hijo de contar para el done del padre — isOptional
// solo importa para el done de BLOQUE, no para el de padre/hijo). No
// enlaza ningún plan_block a propósito, para aislar la cascada padre-hijo
// de la cascada bloque. toggleLogToday/adjustCounter y las UI que los
// llaman (SecondaryCard, HabitTreeDnd móvil/escritorio) son wrappers finos
// sobre el mismo applyHabitToggle — no hay un camino de código distinto
// por pantalla, así que ejercitar applyHabitToggle directamente cubre los
// tres puntos de entrada.
//
// Crea su propio hábito de prueba en una fecha falsa (no toca datos
// reales) y lo borra todo al final, pase o falle.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/verify-parent-child-log-sync.ts <email>
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { activities, activityLogs } from "@/lib/db/schema/habitos";
import { applyHabitToggle } from "@/app/dashboard/plan/actions";

const FAKE_DATE = "2099-01-02";

async function hasLog(userId: string, activityId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, userId), eq(activityLogs.activityId, activityId), eq(activityLogs.date, FAKE_DATE)));
  return !!row;
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: verify-parent-child-log-sync.ts <email>");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [parent] = await db
    .insert(activities)
    .values({ userId: owner.id, name: "TEST padre", frequency: "diaria" })
    .returning({ id: activities.id });
  const [childA] = await db
    .insert(activities)
    .values({ userId: owner.id, name: "TEST hijo A", frequency: "diaria", parentId: parent.id })
    .returning({ id: activities.id });
  const [childB] = await db
    .insert(activities)
    .values({ userId: owner.id, name: "TEST hijo B (opcional)", frequency: "diaria", parentId: parent.id, isOptional: true })
    .returning({ id: activities.id });

  try {
    await applyHabitToggle(owner.id, childA.id, FAKE_DATE, true);
    const afterOneChild = await hasLog(owner.id, parent.id);
    console.log(`Padre con solo 1/2 hijos done: tiene log = ${afterOneChild} (esperado false)`);
    if (afterOneChild) throw new Error("FALLÓ: el padre quedó done con un solo hijo marcado");

    await applyHabitToggle(owner.id, childB.id, FAKE_DATE, true);
    const afterBothChildren = await hasLog(owner.id, parent.id);
    console.log(`Padre con 2/2 hijos done (uno is_optional): tiene log = ${afterBothChildren} (esperado true)`);
    if (!afterBothChildren) throw new Error("FALLÓ: marcar ambos hijos no creó el log del padre");

    await applyHabitToggle(owner.id, childB.id, FAKE_DATE, false);
    const afterUnmarkOne = await hasLog(owner.id, parent.id);
    console.log(`Padre tras desmarcar un hijo: tiene log = ${afterUnmarkOne} (esperado false)`);
    if (afterUnmarkOne) throw new Error("FALLÓ: desmarcar un hijo no borró el log del padre");

    console.log("\n✅ OK: el padre recibe su propio activity_log cuando todos sus hijos quedan done, y lo pierde al desmarcar uno.");
  } finally {
    await db.delete(activityLogs).where(and(eq(activityLogs.userId, owner.id), eq(activityLogs.date, FAKE_DATE)));
    await db.delete(activities).where(eq(activities.id, childB.id));
    await db.delete(activities).where(eq(activities.id, childA.id));
    await db.delete(activities).where(eq(activities.id, parent.id));
    console.log("\nLimpieza: borrado el hábito de prueba y sus hijos.");
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
