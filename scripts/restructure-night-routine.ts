// Reestructura la tarde/noche de Miguel (16:00–20:00, lun-sáb; 17:00–20:00
// dom + gym opcional en la mañana del domingo) según la rutina nueva que
// pidió. Un solo uso, con IDs reales de bloques hardcodeados (no busca por
// texto — esos textos van a desaparecer con esta misma corrida).
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/restructure-night-routine.ts             # solo muestra
//   node ... scripts/restructure-night-routine.ts --apply               # guarda
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { plans, planBlocks, planBlockActivities } from "@/lib/db/schema/plan";
import { activities } from "@/lib/db/schema/habitos";

const APPLY = process.argv.includes("--apply");
const WD = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// --- 1. Bloques a borrar (toda la vieja rutina de tarde/noche, 16:00+) ---
const DELETE_IDS = [
  // lun
  "90c78dea-5311-46fb-82dc-21dd55284bd4", // Aseo general
  "a89a3a5b-2fda-418e-b856-6be3aeb96271", // Cocinar y cenar
  "fcf5df74-c2d0-48a8-ab74-f50733e0fdde", // 40/40/40
  "01619faf-c77d-4d81-b174-a4a16f9e2532", // Dormir
  // mar
  "eebca219-5111-4aa0-ba53-736dc03c0f9c", // Aseo diario
  "b0102ebe-8b19-4f6d-8b6b-9e089945549d", // Gimnasio con mamá
  "7875db3e-7eba-4e0e-8094-b03724564ee2", // Cocinar y cenar
  "bcbff1b5-a99f-41f6-8f9b-3acd906be5a6", // 40/40/40
  "91223425-fcdc-40c2-8c1c-79c9bc00519c", // Dormir
  // mié
  "c339ecb5-34fc-433a-ac7f-27627af98b46", // Aseo diario + taza
  "1b440b49-39e7-4a47-97db-b460c12effed", // Cocinar y cenar
  "8229dabf-aab2-42f8-bdd0-331dcc742a05", // 40/40/40
  "1643d3ef-7498-4bbd-9aa0-deeae7d45c45", // Dormir
  // jue
  "4e650d18-13c5-40e0-9bdf-a153a8b1e7f5", // Gimnasio
  "3b3f9d85-561d-4ba8-8aa1-cbe11a33159c", // Aseo diario
  "27dcdd54-4dc4-432f-846c-0729db75e44f", // Cocinar y cenar
  "026d610c-7e02-4e44-83ce-8a38745fc4e0", // 40/40/40
  "b5951d2b-23b5-4072-86f9-1d9a2a4c423b", // Dormir
  // vie
  "1ceab82e-bf88-4502-a7aa-904f0ec86612", // Aseo diario + taza
  "a17ec7f8-f91a-4858-986e-d77db4175cd8", // Cocinar y cenar
  "3ab1e3ab-4e3c-40cc-80c2-11aa1502a703", // 40/40/40
  "f55a378c-c209-4fd5-8de5-8c9ff8fb3856", // Dormir
  // sáb
  "c25f0377-6aee-42cc-8c4e-553d28f6cb91", // Aseo diario
  "481bbbed-a869-4460-b54b-c8f4314f8af5", // Cocinar y cenar
  "f19d89fd-ef72-4dd4-bb58-b7de58547623", // 40/40/40
  "ab4e03ce-aa76-4587-a1c1-3b4890cff493", // Dormir
  // dom
  "f631c7c7-96fb-4cbb-af03-a98c13d52a23", // Taza y lavamanos
  "4ee50682-8e85-4457-9d11-ef74e4ef4059", // Cocinar y cenar
  "299d5327-b45a-4774-872c-730c2fb28ab4", // 40/40/40
  "309204e3-165c-487f-9d43-845d55d5035e", // Dormir
];

// --- 2. Bloques que se ACORTAN o MUEVEN, sin perder su fila/checks ---
const UPDATES: { id: string; label: string; patch: Partial<typeof planBlocks.$inferInsert> }[] = [
  { id: "64df7402-bb23-4b84-8628-8d41dbbfd7ca", label: "mié Clientes 14-16 → 14-15", patch: { endTime: "15:00" } },
  {
    id: "a39c76d0-e7dc-4703-a544-1ededed5e6b8",
    label: "mié Seguimiento 16-17 → 15-16 (no había hueco antes de las 16h)",
    patch: { startTime: "15:00", endTime: "16:00" },
  },
  { id: "928f901d-1aee-4d0e-bbde-7c75004c8783", label: "vie Recorte corto 14-16 → 14-15", patch: { endTime: "15:00" } },
  {
    id: "01a28219-47ba-4483-a1f7-9865cc459aab",
    label: "vie Revisión semanal 16-17 → 15-16 (mismo motivo)",
    patch: { startTime: "15:00", endTime: "16:00" },
  },
  { id: "78e4dacf-aed9-4a45-813c-4c60fcf16147", label: "sáb Libre 15-17 → 15-16 (deja lugar al Gym 16-17)", patch: { endTime: "16:00" } },
];

// --- 3. Bloques nuevos por weekday ---
type NewBlock = {
  startTime: string;
  endTime: string | null;
  text: string;
  kind: string;
  tentative?: boolean;
  isMinimum?: boolean;
  linkActivity?: string; // nombre EXACTO de la activity a enlazar
};

const NIGHT_CHAIN: NewBlock[] = [
  { startTime: "17:00", endTime: "18:00", text: "Limpieza", kind: "casa", linkActivity: "Limpieza" },
  { startTime: "18:00", endTime: "18:20", text: "Hacer cena", kind: "casa" },
  { startTime: "18:20", endTime: "18:40", text: "Cenar", kind: "comida", linkActivity: "Cenar" },
  {
    startTime: "18:40",
    endTime: "19:00",
    text: "Ropa siguiente día y skincare",
    kind: "cuidado",
    isMinimum: true,
    linkActivity: "Pieza, ropa y skincare",
  },
  { startTime: "19:00", endTime: "19:20", text: "Cambiarme", kind: "rutina", isMinimum: true },
  {
    startTime: "19:20",
    endTime: "19:40",
    text: "Agenda de hábitos",
    kind: "rutina",
    isMinimum: true,
    linkActivity: "Agenda de hábitos",
  },
  { startTime: "19:40", endTime: "20:00", text: "Leer", kind: "descanso", isMinimum: true },
  { startTime: "20:00", endTime: null, text: "Dormir", kind: "rutina", isMinimum: true, linkActivity: "Dormir" },
];

const GYM: NewBlock = { startTime: "16:00", endTime: "17:00", text: "Gym", kind: "cuidado" };
const GYM_SUNDAY_MORNING: NewBlock = { startTime: "11:00", endTime: "12:00", text: "Gym", kind: "cuidado", tentative: true };

// Hora nueva de la actividad, sincronizada con el bloque enlazado (el
// domingo comparte la misma hora que el resto salvo Limpieza/Cenar/etc, así
// que sigue habiendo una sola hora por activity).
const HORA_SYNC: Record<string, string> = {
  Limpieza: "17:00",
  Cenar: "18:20",
  "Pieza, ropa y skincare": "18:40",
  "Agenda de hábitos": "19:20",
  Dormir: "20:00",
};

async function main() {
  const [plan] = await db
    .select({ planId: planBlocks.planId, personId: planBlocks.personId })
    .from(planBlocks)
    .where(eq(planBlocks.id, DELETE_IDS[0]));
  if (!plan) throw new Error("No encontré el plan a partir del primer id — revisá los IDs hardcodeados");
  const { planId, personId } = plan;

  const [planRow] = await db.select({ ownerId: plans.ownerId }).from(plans).where(eq(plans.id, planId));
  const acts = await db.select().from(activities).where(eq(activities.userId, planRow.ownerId));
  const actByName = new Map(acts.map((a) => [a.name, a]));

  console.log(`=== Se borran ${DELETE_IDS.length} bloques ===`);
  const toDelete = await db.select().from(planBlocks).where(inArray(planBlocks.id, DELETE_IDS));
  const foundIds = new Set(toDelete.map((b) => b.id));
  for (const id of DELETE_IDS) {
    const b = toDelete.find((x) => x.id === id);
    console.log(b ? `  [${WD[b.weekday]} ${b.startTime}] "${b.text}"` : `  AVISO: no existe el id ${id} (¿ya se borró?)`);
  }

  console.log(`\n=== Se acortan/mueven ${UPDATES.length} bloques ===`);
  for (const u of UPDATES) console.log(`  ${u.label}`);

  const newRows: (NewBlock & { weekday: number })[] = [];
  for (let wd = 0; wd <= 5; wd++) {
    newRows.push({ ...GYM, weekday: wd });
    for (const b of NIGHT_CHAIN) newRows.push({ ...b, weekday: wd });
  }
  for (const b of NIGHT_CHAIN) newRows.push({ ...b, weekday: 6 }); // domingo, sin Gym en la cadena
  newRows.push({ ...GYM_SUNDAY_MORNING, weekday: 6 });

  console.log(`\n=== Se crean ${newRows.length} bloques nuevos ===`);
  for (const b of newRows) {
    const link = b.linkActivity ? (actByName.has(b.linkActivity) ? " (enlaza a " + b.linkActivity + ")" : ` (AVISO: no existe activity "${b.linkActivity}")`) : "";
    console.log(`  [${WD[b.weekday]} ${b.startTime}–${b.endTime ?? "∞"}] "${b.text}" ${b.kind}${b.tentative ? " [tentativo]" : ""}${b.isMinimum ? " [mínimo]" : ""}${link}`);
  }

  console.log(`\n=== Sincronizar hora_sugerida ===`);
  for (const [name, hora] of Object.entries(HORA_SYNC)) {
    const act = actByName.get(name);
    console.log(`  "${name}": ${act?.horaSugerida ?? "?"} → ${hora}`);
  }

  if (!APPLY) {
    console.log("\nDry-run — nada se guardó. Corré con --apply para persistir.");
    return;
  }

  if (DELETE_IDS.length) await db.delete(planBlocks).where(inArray(planBlocks.id, [...foundIds]));
  for (const u of UPDATES) await db.update(planBlocks).set(u.patch).where(eq(planBlocks.id, u.id));

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
        tentative: !!b.tentative,
        isMinimum: !!b.isMinimum,
        queueId: null,
        holidayText: null,
      })),
    )
    .returning({ id: planBlocks.id, weekday: planBlocks.weekday, startTime: planBlocks.startTime, text: planBlocks.text });

  const linkValues: { blockId: string; activityId: string }[] = [];
  for (const row of inserted) {
    const spec = newRows.find((b) => b.weekday === row.weekday && b.startTime === row.startTime && b.text === row.text);
    if (spec?.linkActivity) {
      const act = actByName.get(spec.linkActivity);
      if (act) linkValues.push({ blockId: row.id, activityId: act.id });
    }
  }
  if (linkValues.length) await db.insert(planBlockActivities).values(linkValues);

  for (const [name, hora] of Object.entries(HORA_SYNC)) {
    const act = actByName.get(name);
    if (act) await db.update(activities).set({ horaSugerida: hora }).where(eq(activities.id, act.id));
  }

  console.log(
    `\nGuardado: ${foundIds.size} borrados, ${UPDATES.length} movidos/acortados, ${inserted.length} creados, ${linkValues.length} enlaces, ${Object.keys(HORA_SYNC).length} horas sincronizadas.`,
  );
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
