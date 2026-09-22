// El restructure-night-routine.ts dejó "Hacer cena", "Cambiarme" y "Leer"
// sin enlazar a ningún hábito (a propósito, en ese momento) — y el
// replace-morning-desayuno.ts nunca enlazó "Hacer el desayuno"/"Desayunar".
// Por eso esos 4 no aparecían en la card "Hábitos" del dashboard (solo
// query activities activas). Este script:
//   1. Crea 5 activities nuevas ("diaria"), una por cada texto de bloque,
//      con hora_sugerida = la hora de inicio del bloque, y las enlaza a
//      los 7 bloques semanales (lun-dom) que ya existen con ese texto.
//   2. Crea "Filosofías de vida" ("diaria", sin hora_sugerida — "sin
//      horario fijo" pedido) SIN enlazar a ningún bloque de Plan, porque
//      no tiene horario fijo.
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/link-night-routine-remainder.ts             # solo muestra
//   node ... scripts/link-night-routine-remainder.ts --apply               # guarda
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { planBlocks, planBlockActivities } from "@/lib/db/schema/plan";
import { activities } from "@/lib/db/schema/habitos";

const APPLY = process.argv.includes("--apply");
const WD = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

const USER_ID = "b09061d4-5687-4f8d-b04d-0e324103c152";

const LINKED: { blockText: string; activityName: string; horaSugerida: string }[] = [
  { blockText: "Hacer el desayuno", activityName: "Hacer el desayuno", horaSugerida: "05:20" },
  { blockText: "Desayunar", activityName: "Desayunar", horaSugerida: "05:40" },
  { blockText: "Hacer cena", activityName: "Hacer cena", horaSugerida: "18:00" },
  { blockText: "Cambiarme", activityName: "Cambiarme", horaSugerida: "19:00" },
  { blockText: "Leer", activityName: "Leer", horaSugerida: "19:40" },
];

const UNLINKED_NAME = "Filosofías de vida";

async function main() {
  const existingActs = await db.select().from(activities).where(eq(activities.userId, USER_ID));
  const actByName = new Map(existingActs.map((a) => [a.name, a]));

  console.log("=== Activities nuevas a crear (enlazadas a Plan) ===");
  for (const l of LINKED) {
    const already = actByName.get(l.activityName);
    console.log(
      already
        ? `  "${l.activityName}" ya existe (id ${already.id}) — no se recrea, solo se revisan los enlaces`
        : `  "${l.activityName}" (diaria, hora_sugerida ${l.horaSugerida})`,
    );
  }
  console.log(`\n=== Activity nueva a crear (sin horario, sin enlace a Plan) ===`);
  const alreadyUnlinked = actByName.get(UNLINKED_NAME);
  console.log(
    alreadyUnlinked
      ? `  "${UNLINKED_NAME}" ya existe (id ${alreadyUnlinked.id}) — no se recrea`
      : `  "${UNLINKED_NAME}" (diaria, sin hora_sugerida)`,
  );

  const blockTexts = LINKED.map((l) => l.blockText);
  const blocks = await db
    .select({ id: planBlocks.id, weekday: planBlocks.weekday, text: planBlocks.text, startTime: planBlocks.startTime })
    .from(planBlocks)
    .where(inArray(planBlocks.text, blockTexts));

  console.log(`\n=== Bloques de Plan encontrados por texto (deberían ser 7 de cada uno = ${blockTexts.length * 7}) ===`);
  for (const l of LINKED) {
    const found = blocks.filter((b) => b.text === l.blockText);
    console.log(`  "${l.blockText}": ${found.length}/7 — ${found.map((b) => WD[b.weekday]).sort().join(", ")}`);
  }

  const existingLinks = await db
    .select({ blockId: planBlockActivities.blockId })
    .from(planBlockActivities)
    .where(
      inArray(
        planBlockActivities.blockId,
        blocks.map((b) => b.id),
      ),
    );
  const alreadyLinkedBlockIds = new Set(existingLinks.map((l) => l.blockId));
  const blocksNeedingLink = blocks.filter((b) => !alreadyLinkedBlockIds.has(b.id));
  console.log(`\n=== Enlaces plan_block_activities a crear: ${blocksNeedingLink.length} ===`);

  if (!APPLY) {
    console.log("\nDry-run — nada se guardó. Corré con --apply para persistir.");
    return;
  }

  const nameToId = new Map(actByName);
  for (const l of LINKED) {
    if (!nameToId.has(l.activityName)) {
      const [row] = await db
        .insert(activities)
        .values({ userId: USER_ID, name: l.activityName, frequency: "diaria", horaSugerida: l.horaSugerida, isActive: true })
        .returning();
      nameToId.set(l.activityName, row);
    }
  }
  if (!nameToId.has(UNLINKED_NAME)) {
    const [row] = await db
      .insert(activities)
      .values({ userId: USER_ID, name: UNLINKED_NAME, frequency: "diaria", horaSugerida: null, isActive: true })
      .returning();
    nameToId.set(UNLINKED_NAME, row);
  }

  const linkValues: { blockId: string; activityId: string }[] = [];
  for (const l of LINKED) {
    const act = nameToId.get(l.activityName)!;
    for (const b of blocksNeedingLink.filter((b) => b.text === l.blockText)) {
      linkValues.push({ blockId: b.id, activityId: act.id });
    }
  }
  if (linkValues.length) await db.insert(planBlockActivities).values(linkValues);

  console.log(
    `\nGuardado: ${LINKED.filter((l) => !actByName.has(l.activityName)).length + (alreadyUnlinked ? 0 : 1)} activities creadas, ${linkValues.length} enlaces creados.`,
  );
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
