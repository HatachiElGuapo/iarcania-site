import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { lifeAreas, lifeProjects } from "./brujula";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // 'pendiente' | 'completada' | 'archivada'
    status: text("status").notNull().default("pendiente"),
    // 'alta' | 'media' | 'baja'
    priority: text("priority").notNull().default("media"),
    dueDate: date("due_date"),
    // "HH:MM", opcionales
    timeDue: text("time_due"),
    timeEnd: text("time_end"),
    // Vocabulario CATS compartido (ver ideas.ts) — sin CHECK, texto libre.
    category: text("category"),
    notes: text("notes"),
    // Vínculo opcional con Brújula (área→objetivo→proyecto→sub-proyecto).
    projectId: uuid("project_id").references(() => lifeProjects.id, {
      onDelete: "set null",
    }),
    areaId: uuid("area_id").references(() => lifeAreas.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDueDateIdx: index("tasks_user_due_date_idx").on(t.userId, t.dueDate),
    statusCheck: check(
      "tasks_status_chk",
      sql`${t.status} IN ('pendiente','completada','archivada')`,
    ),
    priorityCheck: check(
      "tasks_priority_chk",
      sql`${t.priority} IN ('alta','media','baja')`,
    ),
  }),
);

// "Foco del día" — compartida conceptualmente por Trabajo (list_type='trabajo')
// y, en el original, por Actividades (hoy/extra). Por ahora solo apunta a
// tasks; cuando se migre Citas, taskType podrá distinguir una referencia a
// appointments.
export const dailyFocus = pgTable(
  "daily_focus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // 'hoy' | 'extra' | 'trabajo'
    listType: text("list_type").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    // 'task' | 'cita' — hoy siempre 'task' (no hay appointments todavía)
    taskType: text("task_type").notNull().default("task"),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateListIdx: index("daily_focus_user_date_list_idx").on(
      t.userId,
      t.date,
      t.listType,
    ),
    noDuplicateTask: uniqueIndex("daily_focus_unique_task_idx").on(
      t.userId,
      t.date,
      t.listType,
      t.taskId,
    ),
    listTypeCheck: check(
      "daily_focus_list_type_chk",
      sql`${t.listType} IN ('hoy','extra','trabajo')`,
    ),
  }),
);

// Bitácora de trabajo por canal de contenido (antes "project" — en realidad
// siempre fue el nombre del canal, no una referencia a una tabla projects).
export const workNotes = pgTable(
  "work_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 'iarcania' | 'voidstoic'
    channel: text("channel").notNull(),
    content: text("content").notNull(),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userChannelIdx: index("work_notes_user_channel_idx").on(
      t.userId,
      t.channel,
    ),
  }),
);
