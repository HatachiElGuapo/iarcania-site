import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Vocabulario compartido por plan_blocks.kind (NOT NULL) y plan_events.kind
// (nullable — 3 eventos del seed, como el cumpleaños de Miguel, no traen
// categoría).
const PLAN_KINDS = ["ingresos", "juntos", "cuidado", "comida", "casa", "rutina", "descanso", "cita"] as const;

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("plans_owner_idx").on(t.ownerId),
  }),
);

// user_id nullable a propósito: Diana no tiene login todavía — más adelante
// permite que vea su propia columna cuando lo tenga.
export const planPeople = pgTable(
  "plan_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // Notas de referencia libres (ej. "Umbral 60.000 diarios") — no las
    // consume el resolver, solo se muestran como contexto en /plan/semana.
    notes: text("notes").array(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    planIdx: index("plan_people_plan_idx").on(t.planId),
  }),
);

export const planPhases = pgTable(
  "plan_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    goal: text("goal"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    planDateIdx: index("plan_phases_plan_date_idx").on(t.planId, t.startDate),
  }),
);

// `global`=true → sus items van con phase_id null (ej. Void Stoic, la lista
// no se rehace por fase). `global`=false → un plan_queue_items por fase.
export const planQueues = pgTable(
  "plan_queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    cyclic: boolean("cyclic").notNull().default(false),
    global: boolean("global").notNull().default(false),
    fallback: text("fallback"),
  },
  (t) => ({
    planKeyIdx: uniqueIndex("plan_queues_plan_key_idx").on(t.planId, t.key),
  }),
);

export const planQueueItems = pgTable(
  "plan_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueId: uuid("queue_id")
      .notNull()
      .references(() => planQueues.id, { onDelete: "cascade" }),
    // null si la cola es global (plan_queues.global = true)
    phaseId: uuid("phase_id").references(() => planPhases.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => ({
    queuePhaseIdx: index("plan_queue_items_queue_phase_idx").on(t.queueId, t.phaseId, t.position),
  }),
);

export const planBlocks = pgTable(
  "plan_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => planPeople.id, { onDelete: "cascade" }),
    // 0 = lunes … 6 = domingo
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    // null = hasta dormir (bloque abierto)
    endTime: text("end_time"),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    tentative: boolean("tentative").notNull().default(false),
    isMinimum: boolean("is_minimum").notNull().default(false),
    queueId: uuid("queue_id").references(() => planQueues.id, { onDelete: "set null" }),
    holidayText: text("holiday_text"),
  },
  (t) => ({
    planPersonWeekdayIdx: index("plan_blocks_person_weekday_idx").on(t.personId, t.weekday),
    weekdayCheck: check("plan_blocks_weekday_chk", sql`${t.weekday} BETWEEN 0 AND 6`),
    kindCheck: check("plan_blocks_kind_chk", sql`${t.kind} IN (${sql.raw(PLAN_KINDS.map((k) => `'${k}'`).join(","))})`),
  }),
);

export const planHolidays = pgTable(
  "plan_holidays",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.planId, t.date] }),
  }),
);

export const planEvents = pgTable(
  "plan_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    // null = evento compartido (ej. Nochebuena, Fin de año)
    personId: uuid("person_id").references(() => planPeople.id, { onDelete: "cascade" }),
    // Uno de date/monthDay va lleno — date para eventos de una sola fecha,
    // monthDay (1-31) para recurrentes cada mes (ej. tinte cada 2 meses,
    // el seed lo trata igual el día 20 de cada mes).
    date: date("date"),
    monthDay: integer("month_day"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    text: text("text").notNull(),
    // nullable: 3 eventos del seed (cumpleaños, Nochebuena, fin de año) no
    // traen categoría.
    kind: text("kind"),
  },
  (t) => ({
    planDateIdx: index("plan_events_plan_date_idx").on(t.planId, t.date),
    dateOrMonthDayCheck: check(
      "plan_events_date_or_month_day_chk",
      sql`${t.date} IS NOT NULL OR ${t.monthDay} IS NOT NULL`,
    ),
    kindCheck: check(
      "plan_events_kind_chk",
      sql`${t.kind} IS NULL OR ${t.kind} IN (${sql.raw(PLAN_KINDS.map((k) => `'${k}'`).join(","))})`,
    ),
  }),
);

// Cambia o quita un bloque para UN día concreto sin tocar la plantilla
// semanal. `text` null + removed=false = solo se tocó otra cosa (no aplica
// hoy, pero deja la fila lista); removed=true = el bloque no aparece ese día.
export const planOverrides = pgTable(
  "plan_overrides",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => planBlocks.id, { onDelete: "cascade" }),
    text: text("text"),
    removed: boolean("removed").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.blockId] }),
    planIdx: index("plan_overrides_plan_idx").on(t.planId),
  }),
);

// resolved_text guarda lo que decía el bloque (ya resuelto, plantilla +
// override) al momento de marcarlo — si luego se reordena la cola o se edita
// el bloque, el historial no cambia.
export const planChecks = pgTable(
  "plan_checks",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => planBlocks.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => planPeople.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    resolvedText: text("resolved_text").notNull(),
    note: text("note"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.blockId] }),
    planDateIdx: index("plan_checks_plan_date_idx").on(t.planId, t.date),
    personDateIdx: index("plan_checks_person_date_idx").on(t.personId, t.date),
    statusCheck: check("plan_checks_status_chk", sql`${t.status} IN ('done','skipped')`),
  }),
);
