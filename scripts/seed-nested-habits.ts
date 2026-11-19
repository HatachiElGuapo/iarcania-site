// Siembra el árbol de hábitos anidados (hasta 3 niveles) para 3 bloques del
// "Plan de la casa" — solo para el usuario dueño de ese plan.
//
// "Diario de sueños": el hábito de primer nivel que ya existe con ese mismo
// nombre (hoy oculto por compartir nombre con el bloque) se REUSA como
// padre y se le agregan los hijos — no se reemplaza.
//
// "Cabello y skincare" y "Ropa de mañana y cuarto": el viejo hábito único
// con ese mismo nombre se REEMPLAZA por el desglose de primer nivel de
// abajo — se le quita el enlace en plan_block_activities y se le pone
// is_active=false (conserva su historial en activity_logs, no se borra).
//
// Todo select-then-diff (como link-plan-activities.ts) — re-ejecutable sin
// duplicar nada.
//
// Por defecto es un dry-run: imprime todo, no escribe nada.
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/seed-nested-habits.ts <email>              # solo muestra
//   node ... scripts/seed-nested-habits.ts <email> --apply               # guarda
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import { plans, planPeople, planBlocks, planBlockActivities } from "@/lib/db/schema/plan";
import { activities } from "@/lib/db/schema/habitos";

const APPLY = process.argv.includes("--apply");

type ChildSpec = { name: string; children?: ChildSpec[] };
type TopSpec = { name: string; isOptional?: boolean; children?: ChildSpec[] };
type BlockSpec = { blockText: string; replaceSameName: boolean; top: TopSpec[] };

const BLOCKS: BlockSpec[] = [
  {
    blockText: "Diario de sueños",
    replaceSameName: false,
    top: [
      {
        name: "Diario de sueños",
        children: [
          { name: "¿Soñé? (si recuerdo el sueño, anotarlo)" },
          { name: "¿Quién voy a ser yo hoy?" },
          { name: "3 objetivos para hoy" },
          { name: "¿Con qué intención haré las cosas hoy?" },
        ],
      },
      { name: "Filosofías de vida", isOptional: true },
    ],
  },
  {
    blockText: "Cabello y skincare",
    replaceSameName: true,
    top: [
      {
        name: "Lavar cabello",
        children: [{ name: "Preshampoo" }, { name: "Shampoo" }, { name: "Tratamiento" }, { name: "Acondicionador" }],
      },
      {
        name: "Secar cabello",
        children: [{ name: "Toalla" }, { name: "Termoprotector" }, { name: "Secadora" }],
      },
      {
        name: "Limpiar cara",
        children: [
          { name: "Agua micelar" },
          { name: "Gel de limpieza" },
          { name: "Mascarilla" },
          { name: "Crema hidratante" },
        ],
      },
      { name: "Mascarilla", isOptional: true },
      { name: "Afeitarme", isOptional: true },
    ],
  },
  {
    blockText: "Ropa de mañana y cuarto",
    replaceSameName: true,
    top: [
      {
        name: "Organizar pieza",
        children: [
          { name: "Nada encima de la cama" },
          { name: "Organizar cuadernos" },
          { name: "Verificar las 3 actividades de mañana" },
        ],
      },
      {
        name: "Ropa de mañana",
        children: [
          { name: "Camisa" },
          { name: "Calzoncillos" },
          { name: "Medias" },
          { name: "Pantalón" },
          { name: "Camiseta" },
          { name: "Chaleco" },
          { name: "Gabán" },
          { name: "Corbata" },
          { name: "Botas" },
          { name: "Anillos" },
        ],
      },
    ],
  },
];

type ExistingAct = { id: string; isOptional: boolean };

function actKey(name: string, parentId: string | null): string {
  return `${parentId ?? "root"}:${name}`;
}

// Find-or-create por (userId, name, parentId) — reusa si existe, crea si
// no. Actualiza is_optional si cambió. En dry-run no escribe nada y
// devuelve un id de relleno (no se usa para nada real en ese modo).
async function ensureActivity(
  ownerId: string,
  byKey: Map<string, ExistingAct>,
  name: string,
  parentId: string | null,
  isOptional: boolean,
  log: string[],
  indent: string,
): Promise<string> {
  const key = actKey(name, parentId);
  const existing = byKey.get(key);
  if (existing) {
    if (existing.isOptional !== isOptional) {
      log.push(`${indent}actualizar is_optional de "${name}" → ${isOptional}`);
      if (APPLY) {
        await db.update(activities).set({ isOptional }).where(eq(activities.id, existing.id));
        existing.isOptional = isOptional;
      }
    } else {
      log.push(`${indent}"${name}" ya existe — se reusa`);
    }
    return existing.id;
  }

  log.push(`${indent}crear "${name}"${parentId ? " (hijo)" : ""}${isOptional ? " [secundario]" : ""}`);
  if (!APPLY) return `dry:${key}`;

  const [row] = await db
    .insert(activities)
    .values({ userId: ownerId, name, parentId, isOptional, frequency: "diaria" })
    .returning({ id: activities.id });
  byKey.set(key, { id: row.id, isOptional });
  return row.id;
}

async function ensureChildren(
  ownerId: string,
  byKey: Map<string, ExistingAct>,
  parentId: string,
  children: ChildSpec[],
  log: string[],
  indent: string,
) {
  for (const c of children) {
    const childId = await ensureActivity(ownerId, byKey, c.name, parentId, false, log, indent);
    if (c.children?.length) {
      await ensureChildren(ownerId, byKey, childId, c.children, log, indent + "  ");
    }
  }
}

async function ensureLink(blockId: string, activityId: string, existingLinkKeys: Set<string>, log: string[]) {
  const key = `${blockId}:${activityId}`;
  if (existingLinkKeys.has(key)) return;
  log.push(`  enlazar bloque ${blockId} ↔ activity ${activityId}`);
  if (APPLY) {
    await db.insert(planBlockActivities).values({ blockId, activityId });
    existingLinkKeys.add(key);
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: seed-nested-habits.ts <email> [--apply]");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.ownerId, owner.id), eq(plans.name, "Plan de la casa")));
  if (!plan) throw new Error('No hay un plan "Plan de la casa" para ese usuario');

  const [person] = await db
    .select({ id: planPeople.id, name: planPeople.name })
    .from(planPeople)
    .where(and(eq(planPeople.planId, plan.id), eq(planPeople.userId, owner.id)));
  if (!person) throw new Error("Ese usuario no tiene una persona en el plan");

  const existingActs = await db.select().from(activities).where(eq(activities.userId, owner.id));
  const byKey = new Map<string, ExistingAct>(
    existingActs.map((a) => [actKey(a.name, a.parentId), { id: a.id, isOptional: a.isOptional }]),
  );
  const actById = new Map(existingActs.map((a) => [a.id, a]));

  console.log(`Plan de ${person.name} (owner ${email})\n`);

  for (const spec of BLOCKS) {
    const log: string[] = [];
    const blocks = await db
      .select({ id: planBlocks.id, weekday: planBlocks.weekday, startTime: planBlocks.startTime })
      .from(planBlocks)
      .where(and(eq(planBlocks.planId, plan.id), eq(planBlocks.personId, person.id), eq(planBlocks.text, spec.blockText)));

    console.log(`=== "${spec.blockText}" — ${blocks.length} bloque(s) encontrados ===`);
    for (const b of blocks) console.log(`  weekday ${b.weekday} ${b.startTime}`);
    if (blocks.length === 0) {
      console.log("  AVISO: no encontré ningún plan_blocks con ese texto — se omite este grupo.\n");
      continue;
    }

    const existingLinks = await db
      .select()
      .from(planBlockActivities)
      .where(inArray(planBlockActivities.blockId, blocks.map((b) => b.id)));
    const existingLinkKeys = new Set(existingLinks.map((l) => `${l.blockId}:${l.activityId}`));

    for (const top of spec.top) {
      const topId = await ensureActivity(owner.id, byKey, top.name, null, !!top.isOptional, log, "  ");
      if (top.children?.length) {
        await ensureChildren(owner.id, byKey, topId, top.children, log, "    ");
      }
      for (const b of blocks) {
        await ensureLink(b.id, topId, existingLinkKeys, log);
      }
    }

    if (spec.replaceSameName) {
      const oldKey = actKey(spec.blockText, null);
      const old = byKey.get(oldKey);
      const oldRow = old ? actById.get(old.id) : undefined;
      if (old && oldRow?.isActive) {
        log.push(`  reemplazar "${spec.blockText}" — quitar enlace(s) y poner is_active=false (se conserva el historial)`);
        if (APPLY) {
          await db.delete(planBlockActivities).where(
            and(inArray(planBlockActivities.blockId, blocks.map((b) => b.id)), eq(planBlockActivities.activityId, old.id)),
          );
          await db.update(activities).set({ isActive: false }).where(eq(activities.id, old.id));
        }
      } else {
        log.push(`  (no había un hábito activo llamado "${spec.blockText}" para reemplazar — nada que hacer ahí)`);
      }
    }

    console.log(log.join("\n"));
    console.log("");
  }

  if (!APPLY) {
    console.log("Dry-run — nada se guardó. Corré con --apply para persistir.");
  } else {
    console.log("Guardado.");
  }
}

main()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
