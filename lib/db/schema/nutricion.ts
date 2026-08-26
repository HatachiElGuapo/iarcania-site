import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // 'desayuno' | 'almuerzo' | 'cena' | 'snack'
    mealType: text("meal_type").notNull(),
    description: text("description"),
    // 'casa' | 'fuera'
    location: text("location").notNull().default("casa"),
    calories: integer("calories"),
    proteinG: numeric("protein_g", { precision: 6, scale: 1, mode: "number" }),
    carbsG: numeric("carbs_g", { precision: 6, scale: 1, mode: "number" }),
    fatG: numeric("fat_g", { precision: 6, scale: 1, mode: "number" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("meals_user_date_idx").on(t.userId, t.date),
    mealTypeCheck: check(
      "meals_meal_type_chk",
      sql`${t.mealType} IN ('desayuno','almuerzo','cena','snack')`,
    ),
    locationCheck: check(
      "meals_location_chk",
      sql`${t.location} IN ('casa','fuera')`,
    ),
  }),
);

// Una fila por usuario — metas diarias de macros.
export const nutritionTargets = pgTable("nutrition_targets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  kcalTarget: integer("kcal_target").notNull().default(2000),
  protTarget: numeric("prot_target", {
    precision: 6,
    scale: 1,
    mode: "number",
  })
    .notNull()
    .default(150),
  carbTarget: numeric("carb_target", {
    precision: 6,
    scale: 1,
    mode: "number",
  })
    .notNull()
    .default(200),
  fatTarget: numeric("fat_target", {
    precision: 6,
    scale: 1,
    mode: "number",
  })
    .notNull()
    .default(65),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
