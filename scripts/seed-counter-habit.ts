// Configura "1000 saltos" como hábito contador de primer nivel (frequency
// 'diaria', sin bloque de Plan) — meta 1000, unidad "saltos", pasos de los
// botones +100/+200. Si la activity ya existe (por nombre, para este
// usuario), se actualiza en vez de duplicarla.
//
// Por defecto es un dry-run: imprime qué haría, no escribe nada.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/seed-counter-habit.ts <email>              # solo muestra
//   node ... scripts/seed-counter-habit.ts <email> --apply               # guarda
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { activities } from "@/lib/db/schema/habitos";

const APPLY = process.argv.includes("--apply");

const HABIT_NAME = "1000 saltos";
const TARGET_VALUE = 1000;
const UNIT = "saltos";
const COUNT_STEPS = [100, 200];

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: seed-counter-habit.ts <email> [--apply]");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [existing] = await db
    .select({ id: activities.id, targetValue: activities.targetValue, unit: activities.unit, countSteps: activities.countSteps })
    .from(activities)
    .where(and(eq(activities.userId, owner.id), eq(activities.name, HABIT_NAME)));

  if (existing) {
    console.log(`Ya existe "${HABIT_NAME}" (${existing.id}) — se actualizaría meta/unidad/pasos.`);
  } else {
    console.log(`Se crearía "${HABIT_NAME}" (diaria, primer nivel) con meta ${TARGET_VALUE} ${UNIT}, pasos ${COUNT_STEPS.join(", ")}.`);
  }

  if (!APPLY) {
    console.log("\nDry-run: nada escrito. Repetí con --apply para guardar.");
    return;
  }

  if (existing) {
    await db
      .update(activities)
      .set({ targetValue: TARGET_VALUE, unit: UNIT, countSteps: COUNT_STEPS })
      .where(eq(activities.id, existing.id));
  } else {
    await db.insert(activities).values({
      userId: owner.id,
      name: HABIT_NAME,
      frequency: "diaria",
      targetValue: TARGET_VALUE,
      unit: UNIT,
      countSteps: COUNT_STEPS,
    });
  }

  console.log("Listo.");
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
