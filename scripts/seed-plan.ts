// Importa docs/plan/plan-seed.json (formato del artifact "Plan de la casa")
// al plan de Miguel. Idempotente: si ya existe un plan con el mismo nombre
// para ese dueño, no hace nada.
//
//   node --env-file=.env.local --env-file-if-exists=.env.development.local \
//        --import tsx scripts/seed-plan.ts <email-del-dueño>
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/auth";
import {
  plans,
  planPeople,
  planPhases,
  planQueues,
  planQueueItems,
  planBlocks,
  planHolidays,
  planEvents,
} from "@/lib/db/schema/plan";

const PLAN_NAME = "Plan de la casa";
const WEEKDAY_KEYS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
const PERSON_COLORS: Record<string, string> = {
  miguel: "#8B6CF6",
  diana: "#E8A33D",
};
// Diana sí tiene cuenta en esta app (aunque la spec asumía que no) — se
// enlaza igual que Miguel para que /plan pueda usarlo más adelante; hoy
// ninguna ruta lee este campo.
const PERSON_EMAILS: Record<string, string> = {
  diana: "daguilarisaza@gmail.com",
};

type SeedBlock = {
  id: string;
  t: string;
  e: string | null;
  x: string;
  k: string;
  q?: string;
  hx?: string;
  min?: boolean;
  p?: boolean;
};
type SeedPerson = {
  id: string;
  name: string;
  days: Record<string, SeedBlock[]>;
  notes?: string[];
};
type SeedQueue = { n: string; cyc: boolean; fb?: string; glob?: boolean; items?: string[] };
type SeedPhase = { id: string; n: string; a: string; b: string; meta?: string; q: Record<string, string[]> };
type SeedEvent = {
  d?: string;
  m?: number;
  p?: string;
  t?: string;
  e?: string;
  x: string;
  k?: string;
};
type Seed = {
  people: SeedPerson[];
  queues: Record<string, SeedQueue>;
  phases: SeedPhase[];
  hol: string[];
  events: SeedEvent[];
  range: [string, string];
};

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: seed-plan.ts <email-del-dueño>");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!owner) throw new Error(`No existe un usuario con email ${email}`);

  const [existing] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.ownerId, owner.id), eq(plans.name, PLAN_NAME)));
  if (existing) {
    console.log(`Ya existe el plan "${PLAN_NAME}" (${existing.id}) — no se importa de nuevo.`);
    return;
  }

  const seedPath = path.join(process.cwd(), "docs/plan/plan-seed.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as Seed;

  const otherEmails = Object.values(PERSON_EMAILS);
  const otherUsers = otherEmails.length
    ? await db.select({ id: users.id, email: users.email }).from(users)
    : [];
  const userIdByEmail = new Map(otherUsers.map((u) => [u.email, u.id]));

  await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(plans)
      .values({ ownerId: owner.id, name: PLAN_NAME, startDate: seed.range[0], endDate: seed.range[1] })
      .returning({ id: plans.id });

    // Personas: "miguel" se liga a la sesión del dueño; el resto (Diana) sin
    // login todavía.
    const personIdBySeedId = new Map<string, string>();
    for (const [i, p] of seed.people.entries()) {
      const linkedUserId =
        p.id === "miguel" ? owner.id : (userIdByEmail.get(PERSON_EMAILS[p.id] ?? "") ?? null);
      const [row] = await tx
        .insert(planPeople)
        .values({
          planId: plan.id,
          name: p.name,
          color: PERSON_COLORS[p.id] ?? "#5A5870",
          userId: linkedUserId,
          notes: p.notes ?? null,
          sortOrder: i,
        })
        .returning({ id: planPeople.id });
      personIdBySeedId.set(p.id, row.id);
    }

    // Fases, en orden.
    const phaseIdBySeedId = new Map<string, string>();
    for (const [i, ph] of seed.phases.entries()) {
      const [row] = await tx
        .insert(planPhases)
        .values({
          planId: plan.id,
          name: ph.n,
          startDate: ph.a,
          endDate: ph.b,
          goal: ph.meta ?? null,
          sortOrder: i,
        })
        .returning({ id: planPhases.id });
      phaseIdBySeedId.set(ph.id, row.id);
    }

    // Colas: una fila por key en seed.queues. Los items de las colas
    // globales (glob=true, ej. Void Stoic) vienen directo en `items`; el
    // resto se llena por fase más abajo.
    const queueIdByKey = new Map<string, string>();
    for (const [key, q] of Object.entries(seed.queues)) {
      const [row] = await tx
        .insert(planQueues)
        .values({
          planId: plan.id,
          key,
          name: q.n,
          cyclic: q.cyc,
          global: !!q.glob,
          fallback: q.fb ?? null,
        })
        .returning({ id: planQueues.id });
      queueIdByKey.set(key, row.id);

      if (q.glob && q.items) {
        await tx.insert(planQueueItems).values(
          q.items.map((text, position) => ({ queueId: row.id, phaseId: null, position, text })),
        );
      }
    }

    // Items por fase, para las colas no globales.
    for (const ph of seed.phases) {
      const phaseId = phaseIdBySeedId.get(ph.id)!;
      for (const [key, items] of Object.entries(ph.q)) {
        const queueId = queueIdByKey.get(key);
        if (!queueId) throw new Error(`Cola desconocida "${key}" en fase ${ph.id}`);
        await tx.insert(planQueueItems).values(
          items.map((text, position) => ({ queueId, phaseId, position, text })),
        );
      }
    }

    // Bloques: un weekday (0=lun…6=dom) por persona.
    for (const p of seed.people) {
      const personId = personIdBySeedId.get(p.id)!;
      for (const [weekday, key] of WEEKDAY_KEYS.entries()) {
        const dayBlocks = p.days[key] ?? [];
        for (const b of dayBlocks) {
          await tx.insert(planBlocks).values({
            planId: plan.id,
            personId,
            weekday,
            startTime: b.t,
            endTime: b.e ?? null,
            text: b.x,
            kind: b.k,
            tentative: !!b.p,
            isMinimum: !!b.min,
            queueId: b.q ? (queueIdByKey.get(b.q) ?? null) : null,
            holidayText: b.hx ?? null,
          });
        }
      }
    }

    if (seed.hol.length) {
      await tx.insert(planHolidays).values(seed.hol.map((date) => ({ planId: plan.id, date })));
    }

    if (seed.events.length) {
      await tx.insert(planEvents).values(
        seed.events.map((ev) => ({
          planId: plan.id,
          personId: ev.p ? (personIdBySeedId.get(ev.p) ?? null) : null,
          date: ev.d ?? null,
          monthDay: ev.m ?? null,
          startTime: ev.t ?? null,
          endTime: ev.e ?? null,
          text: ev.x,
          kind: ev.k ?? null,
        })),
      );
    }

    console.log(`Plan "${PLAN_NAME}" importado (${plan.id}).`);
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
