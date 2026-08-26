import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Antes 100% localStorage (`metas_compra`) — lista de deseos priorizada, no
// un tracker de ahorro progresivo (no hay campo "ahorrado hasta ahora" ni
// en el original ni aquí). Migrada a tabla real por decisión explícita: todo
// dato persistente del proyecto vive en Postgres, no en el navegador.
export const purchaseGoals = pgTable(
  "purchase_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // 'alta' | 'media' | 'baja'
    priority: text("priority").notNull().default("media"),
    targetDate: date("target_date"),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("purchase_goals_user_idx").on(t.userId),
    priorityCheck: check(
      "purchase_goals_priority_chk",
      sql`${t.priority} IN ('alta','media','baja')`,
    ),
  }),
);
