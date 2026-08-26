import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Antes 7 quehaceres hardcodeados en el cliente (CHORES_DEF) — gestionables
// por el usuario, mismo criterio que accounts/exercises/bills.
export const choreTypes = pgTable(
  "chore_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    // Permite varias ocurrencias/notas el mismo día (ej. Cocinar, Loza).
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("chore_types_user_idx").on(t.userId),
  }),
);

// Antes tabla única "chores" que mezclaba definición + registro (name era
// el id del quehacer hardcodeado). Separada: choreTypes = definición,
// choreLogs = cada ocurrencia o nota. doneBy es texto libre (no un FK a un
// segundo usuario real) — decisión explícita del usuario, igual criterio
// que assignedTo en tasks: sin modelo multiusuario real todavía.
export const choreLogs = pgTable(
  "chore_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    choreTypeId: uuid("chore_type_id")
      .notNull()
      .references(() => choreTypes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // null = fila de solo-nota, no una ocurrencia completada.
    doneBy: text("done_by"),
    doneAt: text("done_at"),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("chore_logs_user_date_idx").on(t.userId, t.date),
    typeDateIdx: index("chore_logs_type_date_idx").on(t.choreTypeId, t.date),
  }),
);
