// Borra "Escritura" y "Planificación del día" (7 días cada una) y las
// reemplaza por "Hacer el desayuno" (05:20-05:40) y "Desayunar"
// (05:40-06:00) — mismo hueco, sin mover el bloque de las 06:00.
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/replace-morning-desayuno.ts             # solo muestra
//   node ... scripts/replace-morning-desayuno.ts --apply               # guarda
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { planBlocks } from "@/lib/db/schema/plan";

const APPLY = process.argv.includes("--apply");
const WD = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

const DELETE_IDS = [
  "c974fd46-eb39-4451-850f-7aa49838e007", // lun Escritura
  "6cd2bedc-d134-431f-a04f-ad1bfeae07d0", // lun Planificación del día
  "eba0114f-4e63-43d8-ab6d-12e640a7be67", // mar Escritura
  "0e69b8e6-6f2e-4e37-b837-ce504e45249c", // mar Planificación del día
  "ba505172-967a-402c-83e5-cbbdd26cc8c8", // mié Escritura
  "0e7355f7-5a14-41aa-b0ad-9c34aac2b10d", // mié Planificación del día
  "315eecaa-5732-4fe8-8d65-b321318f6c96", // jue Escritura
  "843d661b-dcdc-4527-9d9b-791dc688c0d0", // jue Planificación del día
  "9eda605a-b92f-40ec-b951-6ab56c7f2685", // vie Escritura
  "67ab2721-f572-4d79-90e2-b1badece9bb0", // vie Planificación del día
  "125529b4-c3ad-448b-9f6d-4fdb5c26cd86", // sáb Escritura
  "19bb4ad8-c95d-4951-9da7-c591c4a81314", // sáb Planificación del día
  "86011ba3-4a72-407d-a11b-ed908b3ea73c", // dom Escritura
  "db123779-ab07-4229-ad9f-6159ce0ec125", // dom Planificación del día
];

async function main() {
  const [ref] = await db
    .select({ planId: planBlocks.planId, personId: planBlocks.personId })
    .from(planBlocks)
    .where(eq(planBlocks.id, DELETE_IDS[0]));
  if (!ref) throw new Error("No encontré el plan a partir del primer id");
  const { planId, personId } = ref;

  const toDelete = await db.select().from(planBlocks).where(inArray(planBlocks.id, DELETE_IDS));
  console.log(`=== Se borran ${toDelete.length} de ${DELETE_IDS.length} bloques esperados ===`);
  for (const id of DELETE_IDS) {
    const b = toDelete.find((x) => x.id === id);
    console.log(b ? `  [${WD[b.weekday]}] "${b.text}"` : `  AVISO: no existe el id ${id}`);
  }

  const newRows = [];
  for (let wd = 0; wd <= 6; wd++) {
    newRows.push({ weekday: wd, startTime: "05:20", endTime: "05:40", text: "Hacer el desayuno", kind: "casa" });
    newRows.push({ weekday: wd, startTime: "05:40", endTime: "06:00", text: "Desayunar", kind: "comida" });
  }
  console.log(`\n=== Se crean ${newRows.length} bloques nuevos ===`);
  for (const b of newRows) console.log(`  [${WD[b.weekday]} ${b.startTime}–${b.endTime}] "${b.text}" ${b.kind}`);

  console.log(
    "\nAVISO: 'Escritura' y 'Planificación' son hábitos enlazados (activities) — al borrar estos bloques, plan_block_activities los desenlaza en cascada. Van a volver a aparecer como hábito virtual suelto en Agenda a su hora_sugerida (05:20 y 05:40), superpuestos con el desayuno nuevo, hasta que digas qué hacer con esos 2 hábitos.",
  );

  if (!APPLY) {
    console.log("\nDry-run — nada se guardó. Corré con --apply para persistir.");
    return;
  }

  if (toDelete.length) await db.delete(planBlocks).where(inArray(planBlocks.id, toDelete.map((b) => b.id)));
  const inserted = await db
    .insert(planBlocks)
    .values(
      newRows.map((b) => ({
        planId,
        personId,
        weekday: b.weekday,
        startTime: b.startTime,
        endTime: b.endTime,
        text: b.text,
        kind: b.kind,
        tentative: false,
        isMinimum: false,
        queueId: null,
        holidayText: null,
      })),
    )
    .returning({ id: planBlocks.id });
  console.log(`\nGuardado: ${toDelete.length} borrados, ${inserted.length} creados.`);
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
