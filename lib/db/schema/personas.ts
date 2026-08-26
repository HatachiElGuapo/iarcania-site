import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'yo' | 'amigo' | 'familia' | 'conocido' | 'trabajo'
    relationship: text("relationship").notNull().default("amigo"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("people_user_idx").on(t.userId),
  }),
);

// Antes "birthdays" — el original guardaba ahí tanto cumpleaños vinculados a
// una persona como fechas sueltas (pagos, aniversarios, eventos). Renombrada
// para reflejar lo que realmente es. También se quitó `relationship_type`,
// una columna duplicada de `type` en el original.
export const importantDates = pgTable(
  "important_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'cumpleanos' | 'especial' | 'aniversario' | 'cita' | 'pago' | 'evento'
    type: text("type").notNull().default("evento"),
    relationship: text("relationship"),
    day: integer("day").notNull(),
    month: integer("month").notNull(),
    // Si viene de Personas — se borra en cascada si se borra la persona.
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("important_dates_user_idx").on(t.userId),
    // Un solo cumpleaños sincronizado por persona.
    personIdx: uniqueIndex("important_dates_person_idx").on(t.personId),
    dayCheck: check("important_dates_day_chk", sql`${t.day} BETWEEN 1 AND 31`),
    monthCheck: check(
      "important_dates_month_chk",
      sql`${t.month} BETWEEN 1 AND 12`,
    ),
  }),
);
