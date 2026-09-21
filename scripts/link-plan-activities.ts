// Enlaza plan_blocks con activities (habitos) vía plan_block_activities —
// solo para el plan de Miguel. Dos estrategias:
//
//   1. Mañana: match automático por nombre normalizado + hora exacta (sin
//      fuzzy). Cubre los 6 hábitos matutinos, uno por weekday.
//   2. Noche: mapeo explícito (la rutina nocturna de activities quedó vieja
//      frente al Plan, no hay match 1:1 por nombre) — ver NIGHT_LINKS y el
//      caso especial de "Limpieza" más abajo.
//
// También sincroniza activities.hora_sugerida con la hora del bloque
// enlazado (cuando todos los bloques enlazados comparten una sola hora), y
// desactiva los 3 hábitos sin equivalente en el Plan (DEACTIVATE).
//
// Por defecto es un dry-run: imprime todo, no escribe nada.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/link-plan-activities.ts <email>            # solo muestra
//   node ... scripts/link-plan-activities.ts <email> --apply             # guarda
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { plans, planPeople, planBlocks, planBlockActivities } from "@/lib/db/schema/plan";
import { activities } from "@/lib/db/schema/habitos";

const APPLY = process.argv.includes("--apply");

const WEEKDAY_NAMES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// Mapeo explícito de la rutina nocturna — nombre de activity → texto EXACTO
// del bloque de Plan al que se enlaza en cada weekday que lo tenga.
const NIGHT_LINKS: { activityName: string; blockText: string; syncHora: boolean }[] = [
  { activityName: "Planificación", blockText: "Planificación del día", syncHora: true },
  { activityName: "Dormir", blockText: "Dormir", syncHora: true },
  { activityName: "Cenar", blockText: "Cocinar y cenar", syncHora: true },
  { activityName: "Agenda de hábitos", blockText: "40/40/40: cambiarse, agenda de hábitos, leer", syncHora: true },
  { activityName: "Pieza, ropa y skincare", blockText: "40/40/40: cambiarse, agenda de hábitos, leer", syncHora: true },
];

// "Limpieza" no tiene un texto fijo — cada weekday tiene su propio bloque de
// aseo (lunes: "Aseo general…"; domingo no dice "Aseo", pero "Taza y
// lavamanos" es el equivalente de ese día). Un bloque por weekday.
const LIMPIEZA_MATCH = (text: string) => /aseo/i.test(text) || text === "Taza y lavamanos";

const DEACTIVATE = ["Diario introspectivo", "Estirar", "Estiramiento nocturno"];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: link-plan-activities.ts <email> [--apply]");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.ownerId, owner.id));
  if (!plan) throw new Error("No hay plan para ese usuario");

  const [person] = await db
    .select({ id: planPeople.id, name: planPeople.name })
    .from(planPeople)
    .where(and(eq(planPeople.planId, plan.id), eq(planPeople.userId, owner.id)));
  if (!person) throw new Error("Ese usuario no tiene una persona en el plan");

  const blocks = await db
    .select()
    .from(planBlocks)
    .where(and(eq(planBlocks.planId, plan.id), eq(planBlocks.personId, person.id)));

  const acts = await db.select().from(activities).where(eq(activities.userId, owner.id));
  const actByNormalizedName = new Map(acts.map((a) => [normalize(a.name), a]));
  const actByName = new Map(acts.map((a) => [a.name, a]));

  const existingLinks = await db
    .select()
    .from(planBlockActivities)
    .where(
      inArray(
        planBlockActivities.blockId,
        blocks.map((b) => b.id),
      ),
    );
  const existingKeys = new Set(existingLinks.map((l) => `${l.blockId}:${l.activityId}`));

  type Link = { block: (typeof blocks)[number]; activity: (typeof acts)[number]; via: string };
  const links: Link[] = [];
  const unmatched: (typeof blocks)[number][] = [];
  const usedNightActivityNames = new Set(NIGHT_LINKS.map((r) => r.activityName));

  // --- 1. Mañana: match automático nombre normalizado + hora exacta ---
  for (const b of blocks) {
    const act = actByNormalizedName.get(normalize(b.text));
    if (act && act.horaSugerida === b.startTime && !usedNightActivityNames.has(act.name)) {
      links.push({ block: b, activity: act, via: "auto (nombre+hora)" });
    }
  }

  // --- 2. Noche: mapeo explícito ---
  for (const rule of NIGHT_LINKS) {
    const act = actByName.get(rule.activityName);
    if (!act) {
      console.warn(`AVISO: no existe la activity "${rule.activityName}" — se ignora esa regla.`);
      continue;
    }
    const matchingBlocks = blocks.filter((b) => b.text === rule.blockText);
    if (matchingBlocks.length === 0) {
      console.warn(`AVISO: ningún bloque con texto "${rule.blockText}" para la regla de "${rule.activityName}".`);
    }
    for (const b of matchingBlocks) links.push({ block: b, activity: act, via: `noche: ${rule.activityName}` });
  }

  // --- 2b. Limpieza: un bloque de aseo por weekday ---
  const limpieza = actByName.get("Limpieza");
  if (limpieza) {
    for (let wd = 0; wd < 7; wd++) {
      const candidates = blocks.filter((b) => b.weekday === wd && LIMPIEZA_MATCH(b.text));
      if (candidates.length !== 1) {
        console.warn(
          `AVISO: ${candidates.length} candidatos de aseo en ${WEEKDAY_NAMES[wd]} (esperaba 1) — se ignora ese día para Limpieza.`,
        );
        continue;
      }
      links.push({ block: candidates[0], activity: limpieza, via: "noche: Limpieza" });
    }
  }

  // Bloques sin ningún enlace (para mostrar, informativo — la mayoría son
  // bloques que nunca debieron tener hábito, como tareas de ingresos).
  const linkedBlockIds = new Set(links.map((l) => l.block.id));
  for (const b of blocks) if (!linkedBlockIds.has(b.id)) unmatched.push(b);

  // --- Sincronización de hora_sugerida: solo si TODOS los bloques
  // enlazados de esa activity comparten una sola hora. ---
  const timesByActivity = new Map<string, Set<string>>();
  for (const l of links) {
    const set = timesByActivity.get(l.activity.id) ?? new Set<string>();
    set.add(l.block.startTime);
    timesByActivity.set(l.activity.id, set);
  }
  const horaSyncs: { activity: (typeof acts)[number]; newHora: string }[] = [];
  for (const [activityId, times] of timesByActivity) {
    if (times.size !== 1) continue; // varía por día (ej. Limpieza) — no se sincroniza
    const activity = acts.find((a) => a.id === activityId)!;
    const [newHora] = times;
    if (activity.horaSugerida !== newHora) horaSyncs.push({ activity, newHora });
  }

  const toDeactivate = acts.filter((a) => DEACTIVATE.includes(a.name) && a.isActive);

  // --- Reporte ---
  const newLinks = links.filter((l) => !existingKeys.has(`${l.block.id}:${l.activity.id}`));
  console.log(`Plan de ${person.name} — ${blocks.length} bloques totales.\n`);

  console.log(`=== Enlaces a crear (${newLinks.length}) ===`);
  for (const l of newLinks) {
    console.log(
      `  [${WEEKDAY_NAMES[l.block.weekday]} ${l.block.startTime}] "${l.block.text}"  →  "${l.activity.name}"  (${l.via})`,
    );
  }
  if (links.length > newLinks.length) {
    console.log(`  (${links.length - newLinks.length} ya estaban enlazados — se omiten)`);
  }

  console.log(`\n=== Sincronizar hora_sugerida (${horaSyncs.length}) ===`);
  for (const s of horaSyncs) console.log(`  "${s.activity.name}": ${s.activity.horaSugerida ?? "—"} → ${s.newHora}`);

  console.log(`\n=== Desactivar en Hábitos (${toDeactivate.length}) ===`);
  for (const a of toDeactivate) console.log(`  "${a.name}" (hora_sugerida ${a.horaSugerida})`);

  console.log(`\n=== Bloques sin ningún hábito enlazado (${unmatched.length}) ===`);
  for (const b of unmatched) console.log(`  [${WEEKDAY_NAMES[b.weekday]} ${b.startTime}] "${b.text}"`);

  if (!APPLY) {
    console.log("\nDry-run — nada se guardó. Corré con --apply para persistir.");
    return;
  }

  if (newLinks.length) {
    await db
      .insert(planBlockActivities)
      .values(newLinks.map((l) => ({ blockId: l.block.id, activityId: l.activity.id })));
  }
  for (const s of horaSyncs) {
    await db.update(activities).set({ horaSugerida: s.newHora }).where(eq(activities.id, s.activity.id));
  }
  for (const a of toDeactivate) {
    await db.update(activities).set({ isActive: false }).where(eq(activities.id, a.id));
  }
  console.log(
    `\nGuardado: ${newLinks.length} enlaces, ${horaSyncs.length} horas sincronizadas, ${toDeactivate.length} hábitos desactivados.`,
  );
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
