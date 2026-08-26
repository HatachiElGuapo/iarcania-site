import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const lifeAreas = pgTable(
  "life_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    color: text("color").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    enfoqueActual: text("enfoque_actual"),
    filosofia: text("filosofia"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("life_areas_user_idx").on(t.userId),
  }),
);

// Árbol área→objetivo→proyecto→sub-proyecto: area_id fijo, parent_id
// auto-referenciado da la profundidad (depth 0 = objetivo, 1 = proyecto,
// 2 = sub-proyecto — la UI limita a 3 niveles pero el schema no lo fuerza).
export const lifeProjects = pgTable(
  "life_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    areaId: uuid("area_id")
      .notNull()
      .references(() => lifeAreas.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => lifeProjects.id,
      { onDelete: "cascade" },
    ),
    name: text("name").notNull(),
    description: text("description"),
    // 'activo' | 'completado'
    status: text("status").notNull().default("activo"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("life_projects_user_idx").on(t.userId),
    areaIdx: index("life_projects_area_idx").on(t.areaId),
    parentIdx: index("life_projects_parent_idx").on(t.parentId),
    statusCheck: check(
      "life_projects_status_chk",
      sql`${t.status} IN ('activo','completado')`,
    ),
  }),
);
