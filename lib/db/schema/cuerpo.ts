import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'fuerza' | 'cardio' | 'peso_corporal'
    type: text("type").notNull(),
    muscleGroup: text("muscle_group"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("exercises_user_idx").on(t.userId),
    typeCheck: check(
      "exercises_type_chk",
      sql`${t.type} IN ('fuerza','cardio','peso_corporal')`,
    ),
  }),
);

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // Número de serie dentro del ejercicio+fecha; null para cardio.
    setNumber: integer("set_number"),
    reps: integer("reps"),
    weight: numeric("weight", { precision: 6, scale: 1, mode: "number" }),
    durationMin: numeric("duration_min", {
      precision: 6,
      scale: 1,
      mode: "number",
    }),
    distanceKm: numeric("distance_km", {
      precision: 6,
      scale: 2,
      mode: "number",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("workout_logs_user_date_idx").on(t.userId, t.date),
    exerciseDateIdx: index("workout_logs_exercise_date_idx").on(
      t.exerciseId,
      t.date,
    ),
  }),
);

export const bodyMetrics = pgTable(
  "body_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weightKg: numeric("weight_kg", {
      precision: 5,
      scale: 1,
      mode: "number",
    }),
    sleepHours: numeric("sleep_hours", {
      precision: 4,
      scale: 1,
      mode: "number",
    }),
    bodyFatPct: numeric("body_fat_pct", {
      precision: 4,
      scale: 1,
      mode: "number",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex("body_metrics_user_date_idx").on(
      t.userId,
      t.date,
    ),
  }),
);
