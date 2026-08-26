import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'cultural' | 'amigos' | 'familia' | 'visita'
    category: text("category").notNull().default("visita"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("event_types_user_idx").on(t.userId),
    categoryCheck: check(
      "event_types_category_chk",
      sql`${t.category} IN ('cultural','amigos','familia','visita')`,
    ),
  }),
);

// Cada vez que ocurre un tipo de evento — el original la llamaba desde
// Citas también (appointments.event_type_id, todavía no migrado).
export const eventOccurrences = pgTable(
  "event_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    cost: numeric("cost", { precision: 12, scale: 2, mode: "number" }),
    people: text("people"),
    location: text("location"),
    notes: text("notes"),
    // 'genial' | 'normal' | 'dificil' | null
    mood: text("mood"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    typeDateIdx: index("event_occurrences_type_date_idx").on(
      t.eventTypeId,
      t.date,
    ),
    userIdx: index("event_occurrences_user_idx").on(t.userId),
    moodCheck: check(
      "event_occurrences_mood_chk",
      sql`${t.mood} IS NULL OR ${t.mood} IN ('genial','normal','dificil')`,
    ),
  }),
);
