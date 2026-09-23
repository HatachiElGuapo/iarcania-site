import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { scripts } from "./guiones";
import { books } from "./libros";

// Núcleo limpio del sistema de hábitos del original — decisión explícita
// del usuario de dejar fuera lo que el propio os.js dejó a medias
// (habit_strikes/reset de racha nunca implementado, modo crisis, el
// compuesto "20/20/20", y ~30 comportamientos hardcodeados por ID de
// hábito específico). Ver NOTES.md.
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    // 'diaria' | 'semanal' | 'mensual' | 'unica' | 'recurrente' | 'trabajo'
    frequency: text("frequency").notNull().default("diaria"),
    // Solo para frequency='trabajo': qué días de la semana aplica (0=lunes
    // … 6=domingo, mismo orden que plan_blocks.weekday). Null en los demás
    // tipos.
    diasSemana: integer("dias_semana").array(),
    horaSugerida: text("hora_sugerida"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    // Contenido persistente del hábito — distinto de activity_logs.notes
    // (la nota de un día puntual, "qué hiciste hoy"). Este es un texto que
    // se va afinando con el tiempo, sin fecha — ej. el guion de la rutina
    // de la mañana, escrito de a poco antes de dormir.
    notes: text("notes"),
    // Guion vinculado — para "llamarlo" desde el hábito, ej. abrir el guion
    // antes de un bloque de rutina.
    scriptId: uuid("script_id").references(() => scripts.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("activities_user_idx").on(t.userId),
    frequencyCheck: check(
      "activities_frequency_chk",
      sql`${t.frequency} IN ('diaria','semanal','mensual','unica','recurrente','trabajo')`,
    ),
  }),
);

// Lista de una actividad "trabajo" (ej. "Contactar negocios" → un item por
// negocio a contactar; "Void Stoic: edición y guion" → un item por video).
// A diferencia de las colas de Plan, la posición NO avanza por calendario:
// avanza según cuántas veces se marcó hecha la actividad en activity_logs
// (item actual = count(activity_logs) % cantidad de items). Si un día no
// se cumple, el mismo item sigue esperando al día siguiente — no se pierde
// el turno ni hay que esperar a que la cola dé toda la vuelta. Pedido
// explícito, después de ver que las colas de Plan sí avanzan por
// calendario pase lo que pase.
export const activityQueueItems = pgTable(
  "activity_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    notes: text("notes"),
    scriptId: uuid("script_id").references(() => scripts.id, { onDelete: "set null" }),
    bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activityIdx: index("activity_queue_items_activity_idx").on(t.activityId, t.position),
  }),
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    value: numeric("value", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    activityDateIdx: index("activity_logs_activity_date_idx").on(
      t.activityId,
      t.date,
    ),
    userDateIdx: index("activity_logs_user_date_idx").on(t.userId, t.date),
  }),
);
